# Blog Automation

Automated weekly blog posts (every Friday) based on GitHub repository activity. Generates professional, intelligent, and humorous dev digests and publishes them to Notion.

## How It Works

1. **GitHub** – Checks commits in your configured repos for the past 7 days
2. **OpenAI** – Generates blog posts with a witty, professional tone
3. **Notion** – Creates new pages in your Notion workspace

**Posts generated each week:**
- **Per-repo posts** – One dedicated post per repository (with activity or “quiet week” style)
- **Generic post** – One summary post aggregating all repo activity (the “Week the Codebase…” style)

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
| `NOTION_GENERIC_BLOG_PARENT_ID` | (Optional) Separate parent for the generic summary post (page mode only) |
| `OPENAI_API_KEY` | OpenAI API key for content generation |
| `CRON_SECRET` | (Optional) Secret to protect the cron endpoint |
| `DEVTO_API_KEY` | (Optional) Dev.to API key – auto-publish generic post to Dev.to ([get key](https://dev.to/settings/extensions)) |

**Notion setup:**

1. Create an [Internal Integration](https://www.notion.so/my-integrations)
2. Copy the secret (starts with `ntn_`)
3. Create a page (or database) for blog posts and **share it** with your integration (⋯ → Add connections)
4. Copy the page/database ID from the URL: `notion.so/workspace/PAGE_ID?v=...`

**Per-feed filtering (optional):** To get separate feeds per repository and a generic feed:

- Set `NOTION_PARENT_TYPE=database`
- Create a Notion **database** (not a page) and add a **Text** property named `Feed`
- All posts will be tagged with `Feed` = `owner/repo` or `generic`
- Use `/api/blogs?feed=chiku524/blog-automation` or `/api/feed?feed=generic` to filter

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
3. Deploy – crons run **every Friday at 14:00 UTC** (weekly posts) and **every day at 23:59 UTC** (11:59 PM, daily generic post).

To trigger manually via HTTP (e.g. for testing):

```bash
# Weekly (all repos + generic)
curl "https://your-app.vercel.app/api/generate-blog?secret=YOUR_CRON_SECRET"

# Daily (generic post only, last 24h activity)
curl "https://your-app.vercel.app/api/generate-blog-daily?secret=YOUR_CRON_SECRET"
```

Or with header:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/generate-blog
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/generate-blog-daily
```

## Cron Schedule

- **Weekly** (Fridays 14:00 UTC): `/api/generate-blog` – one post per repo + one generic summary (last 7 days).
- **Daily** (every day 23:59 UTC): `/api/generate-blog-daily` – one generic post with #daily from today’s activity (00:00 UTC to run time) across all repos.

Default: `0 14 * * 5` (weekly) and `59 23 * * *` (daily at 11:59 PM UTC). Edit `vercel.json` to change:

```json
{
  "crons": [
    {
      "path": "/api/generate-blog",
      "schedule": "0 14 * * 5"
    },
    {
      "path": "/api/generate-blog-daily",
      "schedule": "59 23 * * *"
    }
  ]
}
```

Cron format: `minute hour day-of-month month day-of-week` (0 = Sunday, 5 = Friday).

## Public Blog & RSS

After deploying, you get a **public blog**:

- **`/`** – Homepage with post list (feed selector when using database + `Feed` property)
- **`/post/:id`** – Individual post pages (full content from Notion)
- **`/api/blogs`** – List posts (optional `?feed=owner/repo` or `?feed=generic` when using database)
- **`/api/feed`** – RSS 2.0 feed (optional `?feed=owner/repo` or `?feed=generic`)

**Syndicating:** Medium no longer offers direct RSS import, but you can use IFTTT/Zapier to auto-post from your RSS, or manually import from your public blog URL. Dev.to’s API key is at [Settings → Extensions](https://dev.to/settings/extensions); we can add Dev.to auto-publish in a future update.

## Project Structure

```
blog-automation/
├── api/
│   ├── blogs.js           # List blog posts from Notion (optional ?feed=)
│   ├── feeds.js           # List available feeds for selector
│   ├── post.js            # Fetch single post content
│   ├── feed.js            # RSS 2.0 feed (optional ?feed=)
│   └── generate-blog.js   # Vercel serverless + cron handler
├── config/
│   └── repos.json         # Repos to track
├── lib/
│   ├── github.js          # Fetch commit activity
│   ├── ai.js              # Generate post (OpenAI)
│   ├── notion.js          # Create Notion page
│   ├── notion-list.js     # List child pages from Notion
│   └── notion-content.js  # Fetch page content, convert to HTML
├── scripts/
│   └── generate-blog.js   # CLI runner
├── index.html             # Blog homepage
├── post.html              # Post page template
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
