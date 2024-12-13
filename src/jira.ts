import JiraClient from 'jira-client';

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
  accountId: string;  // Add JIRA account ID for proper user identification
}

export interface JiraAttachment {
  id: string;
  filename: string;
  content: string;
  mimeType: string;
  size: number;
  created: string;
}

export interface JiraTicket {
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee: {
      emailAddress: string;
    };
    updated: string;
    created: string;
    attachments: JiraAttachment[];
    comment: {
      comments: Array<{
        id: string;
        body: string;
        author: {
          emailAddress: string;
        };
        created: string;
        updated: string;
      }>;
    };
  };
}

export class JiraService {
  private client: JiraClient;
  private accountId: string;

  constructor(config: JiraConfig) {
    this.client = new JiraClient({
      host: config.host,
      username: config.email,
      password: config.apiToken,
      protocol: 'https',
      apiVersion: '2',
      strictSSL: true,
    });
    this.accountId = config.accountId;  // Use provided JIRA account ID instead of email
  }

  getAccountId(): string {
    return this.accountId;
  }

  async getTicket(ticketKey: string): Promise<JiraTicket> {
    try {
      return await this.client.findIssue(ticketKey, 'summary,description,status,priority,assignee,updated,created,attachments,comment');
    } catch (error) {
      console.error(`Error fetching ticket ${ticketKey}:`, error);
      throw new Error(`Failed to fetch ticket ${ticketKey}`);
    }
  }

  async searchTickets(jql: string): Promise<JiraTicket[]> {
    try {
      const result = await this.client.searchJira(jql, {
        fields: ['summary', 'description', 'status', 'priority', 'assignee', 'updated', 'created', 'attachments', 'comment'],
        maxResults: 50
      });
      return result.issues;
    } catch (error) {
      console.error('Error searching tickets:', error);
      throw new Error('Failed to search tickets');
    }
  }

  async getAttachmentContent(attachment: JiraAttachment): Promise<ArrayBuffer> {
    try {
      const response = await fetch(attachment.content);
      return await response.arrayBuffer();
    } catch (error) {
      console.error(`Error fetching attachment ${attachment.filename}:`, error);
      throw new Error(`Failed to fetch attachment ${attachment.filename}`);
    }
  }

  async getTicketsAssignedToDevin(): Promise<JiraTicket[]> {
    if (!this.accountId) {
      throw new Error('JIRA account ID is required');
    }
    const jql = `assignee = "${this.accountId}"`;
    return this.searchTickets(jql);
  }

  async getTicketsWithDevinMentions(): Promise<JiraTicket[]> {
    if (!this.accountId) {
      throw new Error('JIRA account ID is required');
    }
    const jql = `mentions = "${this.accountId}"`;  // Use proper JIRA mention syntax
    return this.searchTickets(jql);
  }

  async addComment(ticketKey: string, comment: string): Promise<void> {
    try {
      await this.client.addComment(ticketKey, comment);
    } catch (error) {
      console.error(`Error adding comment to ticket ${ticketKey}:`, error);
      throw new Error(`Failed to add comment to ticket ${ticketKey}`);
    }
  }
}
