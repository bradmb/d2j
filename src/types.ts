/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  JIRA_API_TOKEN: string;
  JIRA_EMAIL: string;
  JIRA_URL: string;
  SLACK_BOT_TOKEN: string;
  DEVIN_API_KEY: string;
  SLACK_CHANNEL_ID: string;
  SLACK_SIGNING_SECRET: string;
  JIRA_ACCOUNT_ID: string;
  DEVIN_USER_ID: string;  // Slack user ID for Devin bot
}

export interface SlackMessage {
  text: string;
  thread_ts?: string;
  channel: string;
}

export interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
}

export interface SlackEventPayload {
  type: string;
  channel: string;
  thread_ts?: string;
  text: string;
  user: string;
}

export interface ThreadMapping {
  jira_ticket_key: string;
  slack_thread_ts: string;
  last_checked: string;
}
