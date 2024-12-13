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

interface JiraApiResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: Array<{
    expand: string;
    id: string;
    self: string;
    key: string;
    fields: {
      summary: string;
      description?: string;
      status: {
        self: string;
        description: string;
        iconUrl: string;
        name: string;
        id: string;
        statusCategory: {
          self: string;
          id: number;
          key: string;
          colorName: string;
          name: string;
        };
      };
      priority?: any;
      assignee?: any;
      updated?: string;
      created?: string;
      attachments?: any[];
      comment?: any;
    };
  }>;
}

interface JiraTicketResponse {
  expand: string;
  id: string;
  self: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      self: string;
      description: string;
      iconUrl: string;
      name: string;
      id: string;
      statusCategory: {
        self: string;
        id: number;
        key: string;
        colorName: string;
        name: string;
      };
    };
    priority?: {
      self: string;
      iconUrl: string;
      name: string;
      id: string;
    };
    assignee?: {
      self: string;
      accountId: string;
      emailAddress: string;
      avatarUrls: {
        [key: string]: string;
      };
      displayName: string;
      active: boolean;
      timeZone: string;
      accountType: string;
    };
    updated?: string;
    created?: string;
    attachments?: Array<{
      id: string;
      filename: string;
      content: string;
      mimeType: string;
      size: number;
      created: string;
    }>;
    comment?: {
      comments: Array<{
        id: string;
        body: string;
        author: {
          emailAddress: string;
        };
        created: string;
        updated: string;
      }>;
      self: string;
      maxResults: number;
      total: number;
      startAt: number;
    };
  };
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
    this.accountId = config.accountId;
  }

  getAccountId(): string {
    return this.accountId;
  }

  async getTicket(ticketKey: string): Promise<JiraTicket> {
    console.log('Fetching JIRA ticket:', ticketKey);
    try {
      const requestUrl = `https://${this.host}/rest/api/2/issue/${ticketKey}`;
      const authToken = Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');

      console.log('Making direct fetch request to JIRA API for ticket:', ticketKey);
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JIRA API responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json() as JiraTicketResponse;
      console.log('JIRA API Response for ticket:', ticketKey, JSON.stringify(result, null, 2));

      return {
        key: result.key,
        fields: {
          summary: result.fields.summary,
          description: result.fields.description || '',
          status: {
            name: result.fields.status.name
          },
          priority: result.fields.priority ? { name: result.fields.priority.name } : undefined,
          assignee: {
            emailAddress: result.fields.assignee?.emailAddress || ''
          },
          updated: result.fields.updated || new Date().toISOString(),
          created: result.fields.created || new Date().toISOString(),
          attachments: result.fields.attachments?.map((attachment) => ({
            id: attachment.id,
            filename: attachment.filename,
            content: attachment.content,
            mimeType: attachment.mimeType,
            size: attachment.size,
            created: attachment.created
          })) || [],
          comment: {
            comments: result.fields.comment?.comments.map((comment) => ({
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
      };
    } catch (error: any) {
      console.error(`Error fetching ticket ${ticketKey}:`, {
        error: error,
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      throw new Error(`Failed to fetch ticket ${ticketKey}: ${error.message || String(error)}`);
    }
  }

  async searchTickets(jql: string): Promise<JiraTicket[]> {
    console.log('Starting JIRA ticket search...');
    console.log('JQL Query:', jql);
    const encodedJql = this.encodeJQL(jql);
    console.log('Encoded JQL:', encodedJql);

    try {
      const searchEndpoint = `/rest/api/2/search`;
      const requestUrl = `https://${this.host}${searchEndpoint}`;
      const authToken = Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');

      console.log('JIRA API Request URL:', requestUrl);
      console.log('Making direct fetch request to JIRA API...');

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authToken}`
        },
        body: JSON.stringify({
          jql: jql,
          fields: ['summary', 'description', 'status', 'priority', 'assignee', 'updated', 'created', 'attachments', 'comment'],
          maxResults: 50
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JIRA API responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json() as JiraApiResponse;
      console.log('JIRA API Response:', JSON.stringify(result, null, 2));

      return result.issues.map((issue): JiraTicket => ({
        key: issue.key,
        fields: {
          summary: issue.fields.summary,
          description: issue.fields.description || '',
          status: {
            name: issue.fields.status.name
          },
          priority: issue.fields.priority ? { name: issue.fields.priority.name } : undefined,
          assignee: {
            emailAddress: issue.fields.assignee?.emailAddress || ''
          },
          updated: issue.fields.updated || new Date().toISOString(),
          created: issue.fields.created || new Date().toISOString(),
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
    const jql = `comment ~ "${this.accountId}" AND status NOT IN (Resolved, Closed)`;
    return this.searchTickets(jql);
  }
}
