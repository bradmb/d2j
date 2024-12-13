import { Env } from './types';
import { JiraService, JiraTicket } from './jira';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Starting scheduled check for JIRA tickets...');

    try {
      const jiraService = new JiraService({
        host: 'tech.atlassian.net',
        email: env.JIRA_EMAIL,
        apiToken: env.JIRA_API_TOKEN,
      });

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

          // Download attachments if present
          if (fullTicket.fields.attachments?.length > 0) {
            for (const attachment of fullTicket.fields.attachments) {
              try {
                await jiraService.getAttachmentContent(attachment);
                console.log(`Downloaded attachment ${attachment.filename} for ticket ${ticket.key}`);
              } catch (error) {
                console.error(`Failed to download attachment ${attachment.filename}:`, error);
              }
            }
          }

          // Update or insert last checked timestamp
          await env.DB.prepare(
            `INSERT INTO ticket_checks (ticket_key, last_checked)
             VALUES (?, ?)
             ON CONFLICT(ticket_key) DO UPDATE SET last_checked = excluded.last_checked`
          ).bind(ticket.key, new Date().toISOString()).run();
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
