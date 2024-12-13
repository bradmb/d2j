import { JiraClient } from 'jira-client';

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
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

  constructor(config: JiraConfig) {
    this.client = new JiraClient({
      host: 'tech.atlassian.net',
      username: config.email,
      password: config.apiToken,
      protocol: 'https',
      apiVersion: '2',
      strictSSL: true,
    });
  }

  async getTicket(ticketKey: string): Promise<JiraTicket> {
    try {
      return await this.client.findIssue(ticketKey, 'summary,description,status,assignee,updated,created,attachments,comment');
    } catch (error) {
      console.error(`Error fetching ticket ${ticketKey}:`, error);
      throw new Error(`Failed to fetch ticket ${ticketKey}`);
    }
  }

  async searchTickets(jql: string): Promise<JiraTicket[]> {
    try {
      const result = await this.client.searchJira(jql, {
        fields: ['summary', 'description', 'status', 'assignee', 'updated', 'created', 'attachments', 'comment'],
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
    const jql = 'assignee = devin';
    return this.searchTickets(jql);
  }

  async getTicketsWithDevinMentions(): Promise<JiraTicket[]> {
    const jql = 'text ~ "devin"';
    return this.searchTickets(jql);
  }
}
