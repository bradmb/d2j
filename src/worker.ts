import { Env, SlackEventPayload } from './types';
import { JiraService, JiraTicket } from './jira';
import { SlackService } from './utils/slack';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Starting scheduled check for JIRA tickets...');

    try {
      const jiraService = new JiraService({
        host: env.JIRA_URL,
        email: env.JIRA_EMAIL,
        apiToken: env.JIRA_API_TOKEN,
        accountId: env.JIRA_ACCOUNT_ID,  // Use proper JIRA account ID
      });

      const slackService = new SlackService(env, jiraService);

      // Check for new tickets assigned to Devin
      const tickets = await jiraService.getTicketsAssignedToDevin();

      // Process each ticket
      for (const ticket of tickets) {
        // Check if ticket has already been processed
        const processed = await env.DB.prepare(
          'SELECT 1 FROM ticket_checks WHERE ticket_key = ?'
        ).bind(ticket.key).first();

        if (!processed) {
          console.log(`Processing new ticket ${ticket.key}`);

          // Fetch full ticket details including attachments
          const fullTicket = await jiraService.getTicket(ticket.key);
          const attachments = [];

          // Download attachments if present
          if (fullTicket.fields.attachments?.length > 0) {
            for (const attachment of fullTicket.fields.attachments) {
              try {
                const content = await jiraService.getAttachmentContent(attachment);
                attachments.push(content);
                console.log(`Downloaded attachment ${attachment.filename} for ticket ${ticket.key}`);
              } catch (error) {
                console.error(`Failed to download attachment ${attachment.filename}:`, error);
              }
            }
          }

          // Send ticket details to Slack and store thread mapping
          const ticketMessage = `*New JIRA Ticket Assigned*\n` +
            `*Key:* ${ticket.key}\n` +
            `*Summary:* ${fullTicket.fields.summary}\n` +
            `*Description:* ${fullTicket.fields.description || 'No description provided'}\n` +
            `*Priority:* ${fullTicket.fields.priority?.name || 'Not set'}\n` +
            `*Status:* ${fullTicket.fields.status?.name || 'Unknown'}\n` +
            `*Attachments:* ${attachments.length} file(s)`;

          const result = await slackService.sendJiraTicketUpdate(
            ticket.key,
            fullTicket.fields.summary,
            ticketMessage
          );
          console.log(`Sent ticket ${ticket.key} to Slack with thread ${result.ts}`);

          // Update or insert last checked timestamp
          await env.DB.prepare(
            `INSERT INTO ticket_checks (ticket_key, last_checked)
             VALUES (?, ?)
             ON CONFLICT(ticket_key) DO UPDATE SET last_checked = excluded.last_checked`
          ).bind(ticket.key, new Date().toISOString()).run();
        } else {
          console.log(`Ticket ${ticket.key} has already been processed, skipping...`);
        }
      }

      // Check for new comments mentioning Devin
      console.log('Checking for new comments mentioning Devin...');
      const ticketsWithMentions = await jiraService.getTicketsWithDevinMentions();

      for (const ticket of ticketsWithMentions) {
        // Get the thread mapping for this ticket
        const threadMapping = await env.DB.prepare(
          'SELECT slack_thread_ts, last_checked FROM thread_mappings WHERE jira_ticket_key = ?'
        ).bind(ticket.key).first<{ slack_thread_ts: string; last_checked: string }>();

        if (!threadMapping) {
          console.log(`No thread mapping found for ticket ${ticket.key}, skipping...`);
          continue;
        }

        const lastCheckedDate = new Date(threadMapping.last_checked);

        // Check for new comments after last_checked
        const newComments = ticket.fields.comment.comments.filter(comment =>
          new Date(comment.created) > lastCheckedDate &&
          comment.body.includes(`[~${jiraService.getAccountId()}]`)
        );

        for (const comment of newComments) {
          console.log(`Processing new comment in ticket ${ticket.key}`);

          const commentMessage = `*New Comment in JIRA Ticket*\n` +
            `*From:* ${comment.author.emailAddress}\n` +
            `*Comment:* ${comment.body}`;

          // Send comment to existing Slack thread
          const result = await slackService.sendJiraCommentUpdate(
            ticket.key,
            commentMessage
          );

          if (result) {
            console.log(`Sent comment from ticket ${ticket.key} to Slack thread`);
          }
        }

        if (newComments.length > 0) {
          // Update last checked timestamp
          await env.DB.prepare(
            `UPDATE thread_mappings
             SET last_checked = ?
             WHERE jira_ticket_key = ?`
          ).bind(new Date().toISOString(), ticket.key).run();
        }
      }
    } catch (error) {
      console.error('Error in scheduled task:', error);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.text();
      const signature = request.headers.get('x-slack-signature');
      const timestamp = request.headers.get('x-slack-request-timestamp');

      if (!signature || !timestamp) {
        return new Response('Missing Slack signature headers', { status: 400 });
      }

      const jiraService = new JiraService({
        host: env.JIRA_URL,
        email: env.JIRA_EMAIL,
        apiToken: env.JIRA_API_TOKEN,
        accountId: env.JIRA_ACCOUNT_ID,  // Use proper JIRA account ID
      });

      const slackService = new SlackService(env, jiraService);

      // Verify Slack request signature
      const isValid = await slackService.verifyRequest(signature, timestamp, body);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }

      const event = JSON.parse(body) as { type: string; event?: SlackEventPayload };

      // Handle Slack challenge
      if (event.type === 'url_verification') {
        return new Response(JSON.stringify({ challenge: (event as any).challenge }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle Slack events
      if (event.type === 'event_callback' && event.event) {
        const slackEvent = event.event;

        // Handle message events in threads
        if (slackEvent.type === 'message' && slackEvent.thread_ts && slackEvent.user === env.DEVIN_USER_ID) {
          await slackService.handleDevinReply(slackEvent.thread_ts, slackEvent.text);
          return new Response('OK');
        }
      }

      return new Response('Event type not supported', { status: 400 });
    } catch (error) {
      console.error('Error processing Slack event:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
};
