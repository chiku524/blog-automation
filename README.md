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
| `MEDIUM_API_KEY` | (Optional) Medium Integration token – auto-publish to Medium. *Note: Medium no longer issues new tokens; existing tokens still work.* See [alternatives](#medium-alternatives) below. |

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
- **Daily** (every day 23:59 UTC): `/api/generate-blog-daily` – one generic post with #daily from **that day’s** activity (00:00–23:59 UTC) across all repos. If the cron runs in the first hour of the next UTC day (e.g. 00:01), the post is for the **previous** day so commits match the title.
- **Twitter** (4× per week: Sun, Mon, Wed, Fri 12:00 UTC): `/api/generate-twitter-posts` – one tweet per configured account (see [Twitter setup](#twitter-setup) below).

Default: `0 14 * * 5` (weekly), `59 23 * * *` (daily), `0 12 * * 0,1,3,5` (Twitter). Edit `vercel.json` to change:

```json
{
  "crons": [
    { "path": "/api/generate-blog", "schedule": "0 14 * * 5" },
    { "path": "/api/generate-blog-daily", "schedule": "59 23 * * *" },
    { "path": "/api/generate-twitter-posts", "schedule": "0 12 * * 0,1,3,5" }
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

**Syndicating:** This app can auto-publish the generic post to Dev.to (set `DEVTO_API_KEY`) and to Medium if you have an existing Integration token (`MEDIUM_API_KEY`). Medium no longer issues new API tokens.

<a name="twitter-setup"></a>**Twitter/X:** You can automate 3–4 tweets per week to one or more accounts (each tied to a project). Add accounts in `config/twitter.json` and set env vars per account (see `.env.example`). Each account needs: API Key, API Secret, Access Token, Access Token Secret (OAuth 1.0a user context from the [X Developer Portal](https://developer.x.com)). Set `TWITTER_DEFAULT_MESSAGE` or per-account `{PREFIX}_DEFAULT_MESSAGE` for the cron; or POST a custom message: `curl -X POST -H "Content-Type: application/json" -d '{"message":"Your tweet here"}' "https://your-app.vercel.app/api/generate-twitter-posts?secret=YOUR_CRON_SECRET"`.

<a name="medium-alternatives"></a>**Medium alternatives (no API key):** To get posts to [medium.com/@nico.builds](https://medium.com/@nico.builds) or any Medium profile without a token: (1) Use **IFTTT** or **Zapier** to post from your blog’s RSS feed (`/api/feed` or `/api/feed?feed=generic`) to Medium; (2) use Medium’s **Import a story** (paste your post URL from this blog); or (3) cross-post from Dev.to to Medium via IFTTT if you use Dev.to.

## Project Structure

```
blog-automation/
├── api/
│   ├── blogs.js                  # List blog posts from Notion (optional ?feed=)
│   ├── feeds.js                  # List available feeds for selector
│   ├── post.js                   # Fetch single post content
│   ├── feed.js                   # RSS 2.0 feed (optional ?feed=)
│   ├── generate-blog.js          # Vercel serverless + cron handler (weekly)
│   ├── generate-blog-daily.js    # Daily generic post cron
│   └── generate-twitter-posts.js # Twitter cron (3–4×/week)
├── config/
│   ├── repos.json                # Repos to track
│   └── twitter.json              # Twitter accounts (envPrefix per project)
├── lib/
│   ├── github.js                 # Fetch commit activity
│   ├── ai.js                     # Generate post (OpenAI)
│   ├── notion.js                 # Create Notion page
│   ├── notion-list.js            # List child pages from Notion
│   ├── notion-content.js         # Fetch page content, convert to HTML
│   └── twitter.js                # Post tweet (X API v2, OAuth 1.0a)
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
