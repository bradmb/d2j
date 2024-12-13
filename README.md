# d2j

A Cloudflare Worker that integrates Devin.ai with JIRA and Slack, enabling automated ticket management and communication between these platforms.

## Features

- Automated JIRA ticket monitoring and updates
- Slack integration for ticket notifications and discussions
- Bi-directional communication between JIRA and Slack
- Attachment handling and synchronization
- Duplicate ticket prevention
- Thread-based conversations

## Prerequisites

- [Cloudflare Workers](https://workers.cloudflare.com/) account
- [JIRA](https://www.atlassian.com/software/jira) account with API access
- [Slack](https://slack.com/) workspace with bot integration
- [Node.js](https://nodejs.org/) (v18 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (v3 or later)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com//d2j.git
   cd d2j
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.dev.vars` file in the project root with the following variables:
   ```env
   JIRA_URL=your-domain.atlassian.net
   JIRA_EMAIL=your-jira-email@example.com
   JIRA_API_TOKEN=your-jira-api-token
   JIRA_ACCOUNT_ID=your-jira-account-id
   SLACK_TOKEN=xoxb-your-slack-bot-token
   SLACK_SIGNING_SECRET=your-slack-signing-secret
   SLACK_CHANNEL=your-slack-channel-id
   DEVIN_USER_ID=your-devin-bot-user-id
   ```

4. Set up the D1 database:
   ```bash
   wrangler d1 create d2j
   ```
   Update the `database_id` in `wrangler.toml` with the ID from the command output.

5. Initialize the database schema:
   ```bash
   wrangler d1 execute d2j --file=./schema.sql
   ```

## Development

1. Run the development server:
   ```bash
   npm run dev
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   ```

## Usage

### JIRA Integration

The worker automatically monitors JIRA for:
- New tickets assigned to Devin
- Comments mentioning Devin (using `@mention`)
- Ticket updates and status changes

### Slack Integration

The worker creates and manages Slack threads for each JIRA ticket:
- New tickets create new Slack messages
- Comments are added to the corresponding thread
- Devin's responses in Slack are synchronized back to JIRA

### Configuration

1. JIRA Setup:
   - Generate an API token from your [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
   - Note your account ID from your profile

2. Slack Setup:
   - Create a Slack app in your workspace
   - Add bot user permissions:
     - `chat:write`
     - `channels:history`
     - `groups:history`
   - Install the app to your workspace
   - Copy the bot token and signing secret

3. Cloudflare Setup:
   - Configure the worker with appropriate memory and CPU limits
   - Set up scheduled triggers (default: every 15 minutes)
   - Configure environment variables in the Cloudflare dashboard

## Development Guidelines

- Use TypeScript for all new code
- Follow the existing code structure
- Add appropriate error handling
- Update tests for new features
- Keep the `node_modules` directory in `.gitignore`

## Architecture

The application consists of three main components:

1. JIRA Service (`src/jira.ts`):
   - Handles JIRA API interactions
   - Manages ticket and comment operations
   - Processes attachments

2. Slack Service (`src/utils/slack.ts`):
   - Manages Slack message threading
   - Handles bot interactions
   - Processes message events

3. Worker (`src/worker.ts`):
   - Coordinates between services
   - Handles scheduled tasks
   - Processes webhook events

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Proprietary - All rights reserved
