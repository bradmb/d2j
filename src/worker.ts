import { Env } from './types';
import { JiraService, JiraTicket } from './jira';
import { SlackService } from './utils/slack';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Starting scheduled check for JIRA tickets...');

    try {
      const jiraService = new JiraService({
        host: 'tech.atlassian.net',
        email: env.JIRA_EMAIL,
        apiToken: env.JIRA_API_TOKEN,
      });

      const slackService = new SlackService(env, jiraService);

      // Check for new tickets assigned to Devin
      const tickets = await jiraService.getTicketsAssignedToDevin();

      // Process each ticket
      for (const ticket of tickets) {
        const lastChecked = await env.DB.prepare(
          'SELECT last_checked FROM ticket_checks WHERE ticket_key = ?'
        ).bind(ticket.key).first<{ last_checked: string }>();

        const ticketUpdated = new Date(ticket.fields.updated);
        const lastCheckedDate = lastChecked ? new Date(lastChecked.last_checked) : new Date(0);

        if (!lastChecked || ticketUpdated > lastCheckedDate) {
          console.log(`Processing ticket ${ticket.key}`);

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
          comment.body.toLowerCase().includes('@devin')
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
    return new Response('D2J Worker is running');
  }
};
