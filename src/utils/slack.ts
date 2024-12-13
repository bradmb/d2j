/// <reference types="@cloudflare/workers-types" />
import { Env, SlackEventPayload, SlackMessage, ThreadMapping, SlackApiResponse } from '../types';
import { JiraService } from '../jira';

export class SlackService {
  private token: string;
  private channel: string;
  private signingSecret: string;
  private db: D1Database;
  private jiraService: JiraService;
  private devinUserId: string;  // Add field for Devin's Slack user ID

  constructor(env: Env, jiraService: JiraService) {
    this.token = env.SLACK_TOKEN;  // Changed from SLACK_BOT_TOKEN
    this.channel = env.SLACK_CHANNEL;  // Changed from SLACK_CHANNEL_ID
    this.signingSecret = env.SLACK_SIGNING_SECRET;
    this.db = env.DB;
    this.jiraService = jiraService;
    this.devinUserId = env.DEVIN_USER_ID;  // Store Devin's user ID for mentions
  }

  async sendMessage(message: SlackMessage): Promise<{ ts: string }> {
    console.log('Sending Slack message:', {
      channel: message.channel || this.channel,
      thread_ts: message.thread_ts,
      text_length: message.text.length
    });

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        channel: message.channel || this.channel,
        text: message.text,
        thread_ts: message.thread_ts,
      }),
    });

    if (!response.ok) {
      console.error('Slack API HTTP error:', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Failed to send Slack message: ${response.statusText}`);
    }

    const result = await response.json() as SlackApiResponse;
    console.log('Slack API response:', result);

    if (!result.ok) {
      console.error('Slack API error:', result.error);
      throw new Error(`Slack API error: ${result.error}`);
    }

    if (!result.ts) {
      throw new Error('No timestamp returned from Slack API');
    }

    return { ts: result.ts };
  }

  async sendJiraTicketUpdate(
    ticketKey: string,
    summary: string,
    description: string,
    priority: string,
    status: string,
    attachmentCount: number
  ): Promise<{ ts: string }> {
    const ticketUrl = `https://tech.atlassian.net/browse/${ticketKey}`;
    const message = `<@${this.devinUserId}> *JIRA Ticket ${ticketKey}*
*URL:* ${ticketUrl}
*Summary:* ${summary}
*Description:* ${description}
*Priority:* ${priority}
*Status:* ${status}
*Attachments:* ${attachmentCount} file(s)

Please use your "Jira Credentials" secret to access the ticket. To update the ticket:
1. Open the ticket URL in your web browser
2. Log in using the credentials from your "Jira Credentials" secret
3. Add your comments or updates directly in the web interface`;

    console.log('Sending Slack message with content:', message);

    const result = await this.sendMessage({
      text: message,
      channel: this.channel,
    });

    // Store the thread mapping
    await this.storeThreadMapping(ticketKey, result.ts);
    return result;
  }

  async sendJiraCommentUpdate(
    ticketKey: string,
    comment: string,
    thread_ts?: string
  ): Promise<{ ts: string } | null> {
    const threadTs = thread_ts || await this.getThreadForTicket(ticketKey);
    if (!threadTs) {
      console.log(`No thread found for ticket ${ticketKey}, skipping comment update`);
      return null;
    }

    const ticketUrl = `https://tech.atlassian.net/browse/${ticketKey}`;
    const message = `<@${this.devinUserId}>
*New Comment in JIRA Ticket ${ticketKey}*
*URL:* ${ticketUrl}
${comment}

Please use your "Jira Credentials" secret to access the ticket. Remember to update JIRA when you have questions or complete the work.`;

    return this.sendMessage({
      text: message,
      thread_ts: threadTs,
      channel: this.channel,
    });
  }

  async storeThreadMapping(ticketKey: string, threadTs: string): Promise<void> {
    await this.db.prepare(
      'INSERT OR REPLACE INTO thread_mappings (jira_ticket_key, slack_thread_ts, last_checked) VALUES (?, ?, ?)'
    ).bind(ticketKey, threadTs, new Date().toISOString()).run();
  }

  async getThreadForTicket(ticketKey: string): Promise<string | null> {
    const result = await this.db.prepare(
      'SELECT slack_thread_ts FROM thread_mappings WHERE jira_ticket_key = ?'
    ).bind(ticketKey).first<ThreadMapping>();

    return result?.slack_thread_ts || null;
  }

  async verifyRequest(signature: string, timestamp: string, body: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const baseString = `v0:${timestamp}:${body}`;
    const key = encoder.encode(this.signingSecret);
    const message = encoder.encode(baseString);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureArrayBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      message
    );

    const expectedSignature = `v0=${Array.from(new Uint8Array(signatureArrayBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`;

    return expectedSignature === signature;
  }
}
