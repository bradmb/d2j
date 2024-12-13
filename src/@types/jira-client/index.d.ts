declare module 'jira-client' {
  export interface JiraApiOptions {
    protocol?: string;
    host: string;
    port?: string;
    username?: string;
    password?: string;
    apiVersion?: string;
    strictSSL?: boolean;
    base?: string;
    intermediatePath?: string;
    webhookVersion?: string;
    greenhopperVersion?: string;
  }

  export class JiraApi {
    constructor(options: JiraApiOptions);

    findIssue(issueNumber: string, fields?: string): Promise<any>;
    searchJira(jql: string, options?: { fields?: string[], maxResults?: number }): Promise<{
      issues: Array<any>;
      total: number;
    }>;
  }

  export default JiraApi;
}
