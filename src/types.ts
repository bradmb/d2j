/// <reference types="@cloudflare/workers-types" />

import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  JIRA_API_TOKEN: string;
  JIRA_EMAIL: string;
  JIRA_URL: string;  // Format: your-domain.atlassian.net (e.g., tech.atlassian.net)
  SLACK_TOKEN: string;  // Changed from SLACK_BOT_TOKEN
  SLACK_CHANNEL: string;  // Changed from SLACK_CHANNEL_ID
  SLACK_SIGNING_SECRET: string;
  JIRA_ACCOUNT_ID: string;  // Format: 123456:01234567-89ab-cdef-0123-456789abcdef (JIRA user account ID)
  DEVIN_USER_ID: string;  // Format: U0123ABCD456 (Slack user ID for Devin bot)
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
