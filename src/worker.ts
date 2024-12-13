import { Env } from './types';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Will implement JIRA ticket checking logic here
    console.log('Scheduled task running...');
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return new Response('D2J Worker is running');
  }
};
