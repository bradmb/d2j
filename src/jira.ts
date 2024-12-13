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
    // Validate config
    if (!config.host || !config.email || !config.apiToken || !config.accountId) {
      throw new Error('Missing required JIRA configuration');
    }

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
      console.log('Searching JIRA with JQL:', jql);
      const result = await this.client.searchJira(jql, {
        fields: ['summary', 'description', 'status', 'priority', 'assignee', 'updated', 'created', 'attachments', 'comment'],
        maxResults: 50
      });
      return result.issues;
    } catch (error: unknown) {
      const errorDetails: Record<string, unknown> = {
        raw: error
      };

      if (error instanceof Error) {
        errorDetails.message = error.message;
      }

      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as { response?: { data?: unknown; status?: number } };
        errorDetails.response = apiError.response?.data;
        errorDetails.status = apiError.response?.status;
      }

      console.error('Error searching tickets:', errorDetails);
      throw new Error(`Failed to search tickets: ${errorDetails.message || 'Unknown error'}`);
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
    const jql = `assignee = "${this.accountId}" AND status NOT IN (Resolved, Closed)`;
    return this.searchTickets(jql);
  }

  async getTicketsWithDevinMentions(): Promise<JiraTicket[]> {
    if (!this.accountId) {
      throw new Error('JIRA account ID is required');
    }
    const jql = `mentions = "${this.accountId}" AND status NOT IN (Resolved, Closed)`;
    return this.searchTickets(jql);
  }
}
