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
  private host: string;
  private username: string;
  private apiToken: string;
  private accountId: string;

  private encodeJQL(jql: string): string {
    return encodeURIComponent(jql.trim());
  }

  constructor(config: JiraConfig) {
    if (!config.host || !config.email || !config.apiToken) {
      throw new Error('Invalid JIRA configuration: missing required fields');
    }

    // Store configuration for debugging
    this.host = config.host.replace(/^https?:\/\//, '');
    this.username = config.email;
    this.apiToken = config.apiToken;

    // Configure JIRA client with explicit protocol and API version
    const baseOptions = {
      protocol: 'https',
      host: this.host,
      username: this.username,
      password: this.apiToken,
      apiVersion: '2',
      strictSSL: true,
      timeout: 10000,
      baseOptions: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    };

    this.client = new JiraClient(baseOptions);
    this.accountId = config.accountId;
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
    console.log('Starting JIRA ticket search...');
    console.log('JQL Query:', jql);
    const encodedJql = this.encodeJQL(jql);
    console.log('Encoded JQL:', encodedJql);

    try {
      // Debug request configuration
      const searchEndpoint = `/rest/api/2/search`;
      const requestUrl = `https://${this.host}${searchEndpoint}`;
      console.log('JIRA API Request URL:', requestUrl);
      console.log('JIRA API Request Config:', {
        auth: {
          username: this.username,
          password: '***' // Mask token for security
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log('Making JIRA API request...');
      const result = await this.client.searchJira(encodedJql, {
        fields: ['summary', 'description', 'status', 'priority', 'assignee', 'updated', 'created', 'attachments', 'comment'],
        maxResults: 50
      });
      console.log('JIRA API Response:', JSON.stringify(result, null, 2));

      if (!result || !result.issues) {
        throw new Error('Invalid response format from JIRA API');
      }

      return result.issues.map((issue: any): JiraTicket => ({
        key: issue.key,
        fields: {
          summary: issue.fields.summary,
          description: issue.fields.description,
          status: {
            name: issue.fields.status.name
          },
          priority: issue.fields.priority ? { name: issue.fields.priority.name } : undefined,
          assignee: {
            emailAddress: issue.fields.assignee?.emailAddress || ''
          },
          updated: issue.fields.updated,
          created: issue.fields.created,
          attachments: issue.fields.attachments?.map((attachment: any) => ({
            id: attachment.id,
            filename: attachment.filename,
            content: attachment.content,
            mimeType: attachment.mimeType,
            size: attachment.size,
            created: attachment.created
          })) || [],
          comment: {
            comments: issue.fields.comment?.comments.map((comment: any) => ({
              id: comment.id,
              body: comment.body,
              author: {
                emailAddress: comment.author.emailAddress
              },
              created: comment.created,
              updated: comment.updated
            })) || []
          }
        }
      }));
    } catch (error: any) {
      console.error('JIRA API Error Details:', {
        error: error,
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });

      const errorDetails = {
        raw: error,
        message: error.message || String(error)
      };

      throw new Error(`Failed to search tickets: ${JSON.stringify(errorDetails)}`);
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
