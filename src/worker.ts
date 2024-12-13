import { Env } from './types';

interface JiraSearchResponse {
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      description: string;
      assignee: {
        emailAddress: string;
      };
      updated: string;
    };
  }>;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Starting scheduled check for JIRA tickets...');

    try {
      // Check for new tickets assigned to Devin
      const jiraAuth = btoa(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`);
      const jqlAssigned = 'assignee = currentUser()';

      const response = await fetch(`${env.JIRA_URL}/rest/api/2/search?jql=${encodeURIComponent(jqlAssigned)}`, {
        headers: {
          'Authorization': `Basic ${jiraAuth}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`JIRA API error: ${response.statusText}`);
      }

      const data = await response.json() as JiraSearchResponse;
      const tickets = data.issues;

      // Process each ticket
      for (const ticket of tickets) {
        const lastChecked = await env.DB.prepare(
          'SELECT last_checked FROM ticket_checks WHERE ticket_key = ?'
        ).bind(ticket.key).first<{ last_checked: string }>();

        const ticketUpdated = new Date(ticket.fields.updated);
        const lastCheckedDate = lastChecked ? new Date(lastChecked.last_checked) : new Date(0);

        if (!lastChecked || ticketUpdated > lastCheckedDate) {
          // New or updated ticket found - will implement notification logic in step 010
          console.log(`Processing ticket ${ticket.key}`);

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
