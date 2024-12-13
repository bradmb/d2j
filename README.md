# d2j

A Cloudflare Worker that integrates Devin.ai with JIRA and Slack, enabling automated ticket monitoring and one-way communication from JIRA to Slack. Devin handles all JIRA updates directly.

## Features

- Automated JIRA ticket monitoring
- Slack integration for ticket notifications
- One-way communication from JIRA to Slack
- Attachment handling
- Duplicate ticket prevention
- Thread-based conversations in Slack

## Prerequisites

- [Cloudflare Workers](https://workers.cloudflare.com/) account
- [JIRA](https://www.atlassian.com/software/jira) account with API access
- [Slack](https://slack.com/) workspace with bot integration
- [Node.js](https://nodejs.org/) (v18 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (v3 or later) - Install with `npx wrangler`

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/bradmb/d2j.git
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
   # Create a new D1 database
   npx wrangler d1 create d2j

   # Update wrangler.toml with the database ID from the output above
   # Replace the "placeholder" value in the [[d1_databases]] section
   ```

5. Initialize the database schema:
   ```bash
   # For local development
   npx wrangler d1 execute d2j --local --file=./schema.sql

   # For production deployment
   npx wrangler d1 execute d2j --file=./schema.sql
   ```

   Note: If you encounter a "no such table" error when running the worker:
   - Verify that the schema was deployed successfully using:
     ```bash
     # List tables in local development
     npx wrangler d1 execute d2j --local --command "SELECT name FROM sqlite_master WHERE type='table';"

     # List tables in production
     npx wrangler d1 execute d2j --command "SELECT name FROM sqlite_master WHERE type='table';"
     ```
   - If tables are missing, re-run the schema deployment command for your environment
   - For local development, you may need to restart the worker after schema changes

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
- JIRA comments are added to the corresponding Slack thread
- Devin receives notifications and instructions to update JIRA directly

### Configuration

1. JIRA Setup:
   - Go to your [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
   - Click on "Security" in the left sidebar
   - Under "API token", click "Create and manage API tokens"
   - Click "Create API token", give it a name (e.g., "D2J Integration")
   - Copy the generated token - this is your `JIRA_API_TOKEN`
   - To find your `JIRA_ACCOUNT_ID`:
     1. Log in to JIRA
     2. Click on your profile picture in the top-right
     3. Click "Profile"
     4. Your account ID is in the URL: `https://your-domain.atlassian.net/jira/people/YOUR-ACCOUNT-ID`

2. JIRA Credentials Secret:
   - Create a key-value secret with the following structure:
     - `URL`: Your JIRA instance URL (e.g., companyname.atlassian.net)
     - `Username`: Your JIRA email address
     - `Password`: Your JIRA API token
   - Note: Devin will automatically access these credentials using environment variables:
     - `Jira_Credentials_URL`
     - `Jira_Credentials_Username`
     - `Jira_Credentials_Password`

3. Slack Setup:
   - Go to [Slack API Apps page](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Choose a name and workspace
   - Under "Basic Information":
     - Find "Signing Secret" - this is your `SLACK_SIGNING_SECRET`
   - Go to "OAuth & Permissions":
     - Under "Bot Token Scopes", add required permissions:
       - `chat:write`
       - `channels:history`
       - `groups:history`
     - Install the app to your workspace
     - Copy "Bot User OAuth Token" - this is your `SLACK_TOKEN`
   - To find the `DEVIN_USER_ID`:
     1. Right-click on Devin's name in Slack
     2. Click "View profile"
     3. Click the "•••" (more actions) button
     4. Click "Copy member ID"

4. Cloudflare Setup:
   - Configure the worker with appropriate memory and CPU limits
   - Set up scheduled triggers (default: every 15 minutes)
   - Configure environment variables in the Cloudflare dashboard using `npx wrangler secret put`

## Development Guidelines

- Use TypeScript for all new code
- Follow the existing code structure
- Add appropriate error handling
- Update tests for new features
- Keep the `node_modules` directory in `.gitignore`

## Architecture

The application consists of three main components:

1. JIRA Service (`src/jira.ts`):
   - Handles JIRA API interactions for reading tickets and comments
   - Processes attachments
   - Monitors ticket assignments and mentions

2. Slack Service (`src/utils/slack.ts`):
   - Manages Slack message threading
   - Sends notifications about JIRA updates
   - Maintains thread mappings for organizing conversations

3. Worker (`src/worker.ts`):
   - Coordinates between services
   - Handles scheduled JIRA monitoring
   - Processes incoming events

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Proprietary - All rights reserved
