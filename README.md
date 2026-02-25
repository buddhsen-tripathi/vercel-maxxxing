# CodeReview AI

A multi-agent code review system that runs 4 specialized AI agents in parallel to analyze code snippets and GitHub commits. Built with Next.js, AI SDK, and deployed on Vercel.

**Built in ~2.5 hours** across 7 incremental phases using [Claude Code](https://claude.ai/claude-code) — from `create-next-app` scaffold to a production-ready app with auth, database, multi-agent AI, Discord bot, rate limiting, and a polished UI.

## Features

- **Multi-agent review** — 4 specialized agents (Code Quality, Security, Performance, Testing) run in parallel and return structured findings with severity levels and scores
- **GitHub commit review** — paste a commit URL or shorthand (`owner/repo@sha`) to review diffs directly from GitHub
- **Follow-up chat** — ask context-aware follow-up questions about any review
- **Conversation history** — all reviews are saved and browsable for authenticated users
- **Discord bot** — `/review` to run reviews, `/followup` to ask questions, `/summary` to view results, plus @mention support
- **Real-time streaming** — agent results stream to the UI via SSE as each completes
- **Rate limiting** — sliding-window in-memory rate limiter on all AI endpoints
- **Input validation** — Zod schemas on every API route
- **Responsive UI** — desktop 2-pane layout, mobile tabbed interface, dark mode by default

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack, React Compiler) |
| AI | [AI SDK 6](https://sdk.vercel.ai) with Vercel AI Gateway (`openai/gpt-5-nano`) |
| Auth | [Better Auth](https://www.better-auth.com) (email/password, Drizzle adapter) |
| Database | [Neon PostgreSQL](https://neon.tech) with [Drizzle ORM](https://orm.drizzle.team) |
| UI | [shadcn/ui](https://ui.shadcn.com) (Vercel theme via tweakcn), Tailwind CSS 4, Lucide icons |
| Discord | [Chat SDK](https://chat.sdk.vercel.ai) with `@chat-adapter/discord` |
| Validation | [Zod 4](https://zod.dev) |
| Code display | [Shiki](https://shiki.matsu.io) syntax highlighting, react-markdown |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Next.js App                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Dashboard │  │ History  │  │   Auth (login/    │  │
│  │  (review) │  │  (list)  │  │    signup)        │  │
│  └─────┬─────┘  └────┬─────┘  └───────────────────┘  │
│        │              │                               │
│  ┌─────▼──────────────▼──────────────────────────┐   │
│  │              API Routes                        │   │
│  │  /api/review (SSE)  /api/review/chat  /api/chat│   │
│  └─────────────────┬──────────────────────────────┘   │
│                    │                                  │
│  ┌─────────────────▼──────────────────────────────┐   │
│  │           agents/orchestrator.ts                │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┐ │   │
│  │  │  Code    │ Security │  Perf    │ Testing  │ │   │
│  │  │ Reviewer │  Agent   │  Agent   │  Agent   │ │   │
│  │  └──────────┴──────────┴──────────┴──────────┘ │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  ┌────────────────┐  ┌─────────────┐                  │
│  │  Discord Bot   │  │ Rate Limit  │                  │
│  │  (webhook)     │  │ + Zod       │                  │
│  └────────────────┘  └─────────────┘                  │
└───────────────────────┬───────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Neon PostgreSQL   │
              │  (Drizzle ORM)     │
              └───────────────────┘
```

**Key design decisions:**

- `generateText` + `Promise.allSettled` for multi-agent (not `streamText`) — structured JSON should not be partially streamed
- SSE for streaming agent results to the UI (not AI SDK chat stream) — each agent result is a discrete event
- Shared `orchestrator.ts` used by both the web API and the Discord bot
- Lazy Discord bot initialization to handle missing env vars gracefully

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key (or OpenAI key)

### Setup

1. Clone and install dependencies:

```bash
git clone <repo-url>
cd vercel-maxxxing
npm install
```

2. Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

3. Push the database schema:

```bash
npx drizzle-kit push
```

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Auth (required)
BETTER_AUTH_SECRET=     # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# AI (required)
AI_GATEWAY_API_KEY=     # Vercel AI Gateway key

# Discord bot (optional)
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=
BOT_USERNAME=CodeReviewBot

# GitHub (optional — increases rate limit for commit fetching)
GITHUB_TOKEN=
```

## Project Structure

```
app/
├── page.tsx                    # Landing page
├── dashboard/
│   ├── page.tsx                # Main review interface (2-pane / tabs)
│   └── history/page.tsx        # Review history
├── (auth)/                     # Login & signup
└── api/
    ├── review/route.ts         # Multi-agent review (SSE stream)
    ├── review/chat/route.ts    # Follow-up chat
    ├── review/history/route.ts # Load saved reviews
    ├── chat/route.ts           # Standalone AI chat
    └── webhooks/discord/       # Discord webhook handler

agents/
├── orchestrator.ts             # Parallel agent execution & streaming
├── schemas.ts                  # Zod schemas for agent output
├── constants.ts                # Shared agent labels & icons
├── format.ts                   # Shared formatting utilities
├── code-reviewer.ts            # Code quality system prompt
├── security-agent.ts           # Security analysis system prompt
├── performance-agent.ts        # Performance analysis system prompt
└── testing-agent.ts            # Testing analysis system prompt

components/
├── review/                     # Agent cards, findings, severity badges, history
├── chat/                       # Code input, commit input, message display
├── layout/                     # Sidebar, header
├── auth/                       # Login/signup forms
└── ui/                         # shadcn/ui primitives

hooks/
├── use-review.ts               # Review state & SSE event parsing
└── use-follow-up-chat.ts       # Follow-up chat state & streaming

lib/
├── auth.ts                     # Better Auth server config
├── auth-client.ts              # Client-side auth helpers
├── bot.ts                      # Discord bot (lazy init)
├── discord-commands.ts         # Discord slash command handlers
├── github.ts                   # GitHub commit fetching & diff parsing
├── rate-limit.ts               # Sliding-window rate limiter
├── validations.ts              # Zod input schemas
└── db/
    ├── schema.ts               # Drizzle table definitions
    └── queries.ts              # Database operations
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/review` | POST | Optional | Multi-agent code review (SSE stream) |
| `/api/review/chat` | POST | Required | Follow-up chat on a review conversation |
| `/api/review/history` | GET | Required | Load a saved review by conversation ID |
| `/api/chat` | POST | Required | Standalone AI chat |
| `/api/webhooks/discord` | POST | Signature | Discord bot webhook |

### Rate Limits

- **Review:** 10 requests / hour (per user or IP)
- **Chat:** 30 requests / hour (per user or IP)

## Database Schema

**Auth tables** (managed by Better Auth): `user`, `session`, `account`, `verification`

**App tables:**

- `conversation` — id, title, userId, createdAt, updatedAt
- `message` — id, conversationId, role, content, metadata (JSON), createdAt

Agent results and commit metadata are stored as JSON in message metadata.

## Discord Bot

The bot is optional. If `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, and `DISCORD_APPLICATION_ID` are set, the bot activates automatically.

**[Add CodeReview Bot to your server](https://discord.com/oauth2/authorize?client_id=1475996370224545914&scope=bot+applications.commands)**

### Slash Commands

| Command | Description |
|---|---|
| `/review code:<snippet>` | Run a multi-agent review on pasted code |
| `/review commit_url:<url>` | Review a GitHub commit diff |
| `/followup message:<question>` | Ask a follow-up question about your latest review |
| `/followup message:<question> id:<convId>` | Ask about a specific review |
| `/summary` | Show your latest review summary (or global if unlinked) |
| `/summary id:<convId>` | Show a specific review summary |
| `/connect code:<CODE>` | Link your Discord account to the web app |
| `/disconnect` | Unlink your Discord account |

Register commands with `npx tsx scripts/register-discord-commands.ts`.

### @Mention

You can also mention the bot with a fenced code block for a quick review:

```
@CodeReviewBot
\`\`\`python
def login(password):
    query = f"SELECT * FROM users WHERE pass = '{password}'"
    return db.execute(query)
\`\`\`
```

The bot replies with a formatted summary of all 4 agent findings, truncated to fit Discord's 2000-character limit. Linked users get reviews saved to their account for follow-up via `/followup`.

## Deployment

Deploy to Vercel:

```bash
vercel
```

Make sure to:
1. Set all required environment variables in the Vercel dashboard
2. Run `npx drizzle-kit push` against your production database
3. For Discord, set the webhook URL to `https://your-domain.vercel.app/api/webhooks/discord`

## License

MIT
