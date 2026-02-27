# Blog Automation

Automated weekly blog posts (every Friday) based on GitHub repository activity. Generates professional, intelligent, and humorous dev digests and publishes them to Notion.

## How It Works

1. **GitHub** – Checks commits in your configured repos for the past 7 days
2. **OpenAI** – Generates a blog post from active repos with a witty, professional tone
3. **Notion** – Creates a new page in your Notion workspace

## Security

**Never commit secrets.** Store all tokens in `.env` (gitignored) or Vercel Environment Variables. Rotate any credentials if they were ever exposed.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Repositories

Edit `config/repos.json` with the repos you want to track:

```json
{
  "repositories": [
    {
      "owner": "your-username",
      "repo": "my-app",
      "description": "Main web app – React + Node"
    },
    {
      "owner": "your-username",
      "repo": "api-service",
      "description": "Backend API"
    }
  ]
}
```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token (scopes: `repo`) |
| `NOTION_API_KEY` | Notion [Internal Integration](https://www.notion.so/my-integrations) secret |
| `NOTION_BLOG_PARENT_ID` | Page or database ID where posts will be created |
| `NOTION_PARENT_TYPE` | `page` or `database` (default: `page`) |
| `OPENAI_API_KEY` | OpenAI API key for content generation |
| `CRON_SECRET` | (Optional) Secret to protect the cron endpoint |

**Notion setup:**

1. Create an [Internal Integration](https://www.notion.so/my-integrations)
2. Copy the secret (starts with `ntn_`)
3. Create a page (or database) for blog posts and **share it** with your integration (⋯ → Add connections)
4. Copy the page/database ID from the URL: `notion.so/workspace/PAGE_ID?v=...`

### 4. Run Manually

```bash
npm run generate
```

Dry run (no Notion publish):

```bash
npm run test
```

### 5. Deploy to Vercel (Friday Cron)

1. Connect this repo to [Vercel](https://vercel.com)
2. Add all env vars in Project Settings → Environment Variables
3. Deploy – the cron runs **every Friday at 14:00 UTC** (9am EST)

To trigger manually via HTTP (e.g. for testing):

```bash
curl "https://your-app.vercel.app/api/generate-blog?secret=YOUR_CRON_SECRET"
```

Or with header:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/generate-blog
```

## Cron Schedule

Default: `0 14 * * 5` (Fridays at 14:00 UTC). Edit `vercel.json` to change:

```json
{
  "crons": [
    {
      "path": "/api/generate-blog",
      "schedule": "0 14 * * 5"
    }
  ]
}
```

Cron format: `minute hour day-of-month month day-of-week` (0 = Sunday, 5 = Friday).

## Dashboard

After deploying, the **dashboard** at `/` lists all blog posts from Notion. Visit your Vercel URL to view and open posts over time.

## Project Structure

```
blog-automation/
├── api/
│   ├── blogs.js           # List blog posts from Notion
│   └── generate-blog.js   # Vercel serverless + cron handler
├── config/
│   └── repos.json         # Repos to track
├── lib/
│   ├── github.js          # Fetch commit activity
│   ├── ai.js              # Generate post (OpenAI)
│   ├── notion.js          # Create Notion page
│   └── notion-list.js     # List child pages from Notion
├── scripts/
│   └── generate-blog.js   # CLI runner
├── index.html             # Dashboard UI
├── vercel.json            # Cron + rewrites
└── package.json
```

## Tone & Style

Posts are generated to be:

- **Professional** – Clear, accurate, useful
- **Intelligent** – Connects context, explains what changed and why
- **Humorous** – Witty phrasing, light dev jokes, no corporate fluff

## License

MIT
