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
      console.log('Checking for tickets assigned to Devin...');
      const tickets = await jiraService.getTicketsAssignedToDevin();

      for (const ticket of tickets) {
        // Fetch full ticket details including attachments
        console.log(`Processing ticket ${ticket.key}`);
        const fullTicket = await jiraService.getTicket(ticket.key);

        // Check if ticket has already been processed
        const processed = await env.DB.prepare(
          'SELECT 1 FROM ticket_checks WHERE ticket_key = ?'
        ).bind(ticket.key).first();

        if (!processed) {
          console.log(`New ticket ${ticket.key} detected, sending to Slack...`);

          // Send ticket details to Slack and store thread mapping
          const result = await slackService.sendJiraTicketUpdate(
            ticket.key,
            fullTicket.fields.summary,
            fullTicket.fields.description || 'No description provided',
            fullTicket.fields.priority?.name || 'Not set',
            fullTicket.fields.status?.name || 'Unknown',
            fullTicket.fields.attachments?.length || 0
          );

          // Update or insert last checked timestamp
          await env.DB.prepare(
            `INSERT INTO ticket_checks (ticket_key, last_checked)
             VALUES (?, ?)
             ON CONFLICT(ticket_key) DO UPDATE SET last_checked = excluded.last_checked`
          ).bind(ticket.key, new Date().toISOString()).run();
        }

        // Check for new comments on this assigned ticket
        console.log(`Checking for new comments on ticket ${ticket.key}...`);
        const threadMapping = await env.DB.prepare(
          'SELECT slack_thread_ts, last_checked FROM thread_mappings WHERE jira_ticket_key = ?'
        ).bind(ticket.key).first<{ slack_thread_ts: string; last_checked: string }>();

        if (!threadMapping) {
          console.log(`No thread mapping found for ticket ${ticket.key}, creating new mapping...`);
          const result = await slackService.sendJiraTicketUpdate(
            ticket.key,
            fullTicket.fields.summary,
            fullTicket.fields.description || 'No description provided',
            fullTicket.fields.priority?.name || 'Not set',
            fullTicket.fields.status?.name || 'Unknown',
            fullTicket.fields.attachments?.length || 0
          );

          if (result && result.ts) {
            await env.DB.prepare(
              `INSERT INTO thread_mappings (jira_ticket_key, slack_thread_ts, last_checked)
               VALUES (?, ?, ?)`
            ).bind(ticket.key, result.ts, new Date().toISOString()).run();
          }
          continue;
        }

        const lastCheckedDate = new Date(threadMapping.last_checked);

        // Only process comments that tag Devin and are newer than last check
        const newComments = fullTicket.fields.comment.comments.filter(comment =>
          new Date(comment.created) > lastCheckedDate &&
          comment.body.includes(`[~${jiraService.getAccountId()}]`)
        );

        for (const comment of newComments) {
          console.log(`Found new comment in ticket ${ticket.key}, sending to Slack thread...`);
          const result = await slackService.sendJiraCommentUpdate(
            ticket.key,
            comment.body,
            threadMapping.slack_thread_ts
          );

          if (result) {
            console.log(`Successfully sent comment from ticket ${ticket.key} to Slack thread`);
          }
        }

        if (newComments.length > 0) {
          await env.DB.prepare(
            `UPDATE thread_mappings
             SET last_checked = ?
             WHERE jira_ticket_key = ?`
          ).bind(new Date().toISOString(), ticket.key).run();
        }
      }

      console.log('Scheduled task completed successfully');
    } catch (error) {
      console.error('Error in scheduled task:', error);
      throw error;
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
      }

      return new Response('Event type not supported', { status: 400 });
    } catch (error) {
      console.error('Error processing Slack event:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
};
