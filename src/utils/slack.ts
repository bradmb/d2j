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
      throw new Error(`Failed to send Slack message: ${response.statusText}`);
    }

    const result = await response.json() as SlackApiResponse;
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }

    if (!result.ts) {
      throw new Error('No timestamp returned from Slack API');
    }

    return { ts: result.ts };
  }

  async sendJiraTicketUpdate(ticketKey: string, summary: string, description: string): Promise<{ ts: string }> {
    const ticketUrl = `https://tech.atlassian.net/browse/${ticketKey}`;
    const message = `<@${this.devinUserId}> *JIRA Ticket ${ticketKey}*\n*URL:* ${ticketUrl}\n*Summary:* ${summary}\n*Description:*\n${description}\n\nPlease use your Jira_Credentials secret to access the ticket. Remember to update JIRA when you have questions or complete the work.`;
    const result = await this.sendMessage({
      text: message,
      channel: this.channel,
    });

    // Store the thread mapping
    await this.storeThreadMapping(ticketKey, result.ts);
    return result;
  }

  async sendJiraCommentUpdate(ticketKey: string, comment: string): Promise<{ ts: string } | null> {
    const threadTs = await this.getThreadForTicket(ticketKey);
    if (!threadTs) {
      console.error(`No thread found for ticket ${ticketKey}`);
      return null;
    }

    const ticketUrl = `https://tech.atlassian.net/browse/${ticketKey}`;
    const message = `*New comment on JIRA Ticket ${ticketKey}*\n*URL:* ${ticketUrl}\n${comment}\n\nPlease use your Jira_Credentials secret to access the ticket. Remember to update JIRA when you have questions or complete the work.`;
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
