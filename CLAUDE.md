# TeaFi Bot

## Project Overview

Discord bot for the TeaFi community program. Tea/pink theme.

**Stack:** Bun + TypeScript + Discord.js 14 + PostgreSQL + Drizzle ORM + Redis

**Deploy:** Docker on Hetzner VPS (`/opt/apps/teafi-bot/`)

---

## Architecture

### Core Flow
```
/profile → 🍵 Tea Card (creates user if none)
    ↓
[🍵 Submit Work] → Task Select dropdown → Modal (URL + description)
    ↓
Review Channel → embed with Twitter metrics + AI analysis
    ↓
Admin: [✅ Approve] / [❌ Reject] → Modal with Quality Score + Bonus XP
    ↓
Task Logs (short embed) + DM (detailed embed)
```

### File Structure
```
src/
├── index.ts                    # Entry point
├── bot/
│   ├── client.ts              # Discord.js client
│   ├── deploy-commands.ts     # Command deployment
│   ├── events/                # ready, interactionCreate, messageCreate
│   └── commands/
│       ├── profile.ts         # /profile
│       ├── leaderboard.ts     # /leaderboard
│       ├── sendwork.ts        # /sendwork
│       ├── rewards.ts         # /rewards
│       ├── localleadreport.ts # /localleadreport
│       └── admin/             # Admin commands
├── handlers/
│   ├── buttons/               # submit-work, approve, reject, leaderboard, my-works, dashboard
│   ├── modals/                # work-submission, approval, rejection, local-lead-report
│   └── selectMenus/           # task-select
├── db/
│   ├── schema.ts             # Drizzle tables
│   └── migrations/
├── services/
│   ├── user.service.ts
│   ├── work.service.ts
│   ├── task.service.ts
│   ├── role.service.ts
│   ├── reward.service.ts
│   ├── local-lead.service.ts
│   ├── work-analysis.service.ts
│   ├── ai-work-analyzer.ts
│   └── twitter-scraper.ts
├── state/                     # Redis state + cache
├── jobs/                      # Cron jobs (role check)
├── config/                    # roles, constants
├── discord/                   # embeds
├── ai/                        # AI Helper system
│   ├── ai-helper.service.ts
│   ├── config.ts
│   ├── prompt-guard.ts
│   ├── rate-limiter.ts
│   ├── temp-info.ts
│   └── vector-store.ts
├── knowledge/                 # Knowledge base for AI (markdown files)
└── utils/                     # logger, format, url, id, csv, guards
```

---

## User Commands

| Command | Description |
|---------|-------------|
| `/profile` | 🍵 Tea Card — profile with buttons |
| `/leaderboard` | 🏆 XP leaderboard |
| `/sendwork` | 🍵 Submit work for a task |
| `/rewards` | 💰 Monthly reward estimate |
| `/localleadreport` | 📋 Local Lead monthly report |

## Admin Commands

| Command | Description |
|---------|-------------|
| `/admindashboard` | 📊 Program dashboard |
| `/adminuser @user` | 👤 User details |
| `/adminpending` | ⏳ Pending works |
| `/adminset-role @user <role>` | 🍃 Set TeaFi role |
| `/adminset-xp @user <amount>` | ⭐ Award XP |
| `/adminban @user [reason]` | 🚫 Ban user |
| `/adminunban @user` | ✅ Unban user |
| `/admincreate-task` | 🍵 Create a task |
| `/admintasks` | 📋 List/manage tasks |
| `/adminreport` | 📊 Export CSV reports |
| `/aihelper status` | 🤖 AI Helper status |
| `/aihelper enable/disable` | 🔒 Toggle AI Helper |
| `/aihelper reset-limit @user` | ⏳ Reset rate limit |
| `/aihelper temp-info add/remove/list` | 📝 Manage temp info |

---

## Database Tables

- `users` — user profiles (role, totalXp, bonusXp, worksCount)
- `works` — submitted works (taskId, status, xpAwarded, bonusXpAwarded)
- `tasks` — admin-defined tasks (name, description, xpReward, isActive)
- `twitter_metrics` — Twitter metrics for works
- `xp_history` — XP change history
- `role_history` — role change history
- `local_lead_reports` — Local Lead monthly reports

---

## Role System

| Role | XP Threshold | Multiplier | Auto-assign |
|------|-------------|------------|-------------|
| Newcomer (none) | — | 0 (excluded from pool) | — |
| 🍃 Sprout Leaf | 200 | 0.75x | Yes |
| 🌿 Green Leaf | 650 | 1.3x | Yes |
| 🍂 Golden Leaf | — | 2.5x | No (manual only) |

Roles never auto-demote. Golden Leaf is admin-assigned only.

---

## Monthly Reward Pool

- Leaf Way: 600,000 $TEA/month (configurable via `MONTHLY_POOL` env)
- Local Leaders: 250,000 $TEA/month
- Only users with a role (≥200 XP) participate
- Formula: `reward = (monthlyXp × multiplier) / totalWeightedXp × pool`
- Monthly XP = XP earned in current month only

---

## AI Helper System

AI assistant for answering questions in Discord community chat.

### Architecture
- **Model:** `gpt-4o-mini` (configurable via env)
- **Knowledge:** OpenAI Vector Store + markdown files in `src/knowledge/`
- **Rate Limit:** 10 req/60s per user, 5s cooldown between requests
- **Max Message:** 1000 chars input, 500 tokens output

### Protection Layers
1. **Static Responses** — greetings/offtopic without API call
2. **Keyword Filter** — only responds to program-related questions
3. **Prompt Guard** — injection detection, unicode normalization, offensive filter
4. **Rate Limiter** — atomic Redis operations (Lua scripts)

### Temp Info
Admins can add temporary info included in every AI response:
```bash
/aihelper temp-info add "Bonus event active until March 30!"
/aihelper temp-info list
/aihelper temp-info remove <id>
```

### Cost Estimate
~$2-5/month at average activity (gpt-4o-mini: $0.15/1M input, $0.60/1M output)

---

## Visual Style

**Theme:** Tea / Pink
- Tea Pink: `0xE91E63` (primary)
- Light Pink: `0xF48FB1`
- Gold: `0xFFD700`
- Success Green: `0x4CAF50`

**Emojis:** 🍵🍃🌿🍂🌱⭐✅❌📊📋🏆💎🔗📝

---

## Scripts

```bash
bun run dev          # Development (watch mode)
bun run start        # Production (runs src/index.ts directly)
bun run typecheck    # TypeScript check (tsc --noEmit)
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run deploy       # Deploy commands to Discord
```

---

## Testing

```bash
bun test                    # Run all tests (unit only by default)
bun test tests/unit/        # Run unit tests only
bun test tests/integration/ # Run integration tests (requires test DB)
```

### Integration Tests

Integration tests require a test database. They are **automatically skipped** if:
- `DATABASE_URL` is not set
- `DATABASE_URL` does not contain `test` (safety: prevents running on production)

To run integration tests locally:

```bash
# Start a local test database
docker run -d --name teafi-test-db \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=teafi_test \
  -p 5433:5432 \
  postgres:16-alpine

# Run integration tests
DATABASE_URL=postgresql://test:test@localhost:5433/teafi_test bun test tests/integration/

# Cleanup
docker stop teafi-test-db && docker rm teafi-test-db
```

---

## Environment Variables

See `.env.example` for the full list. Key groups:

```bash
# Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

# Database
POSTGRES_USER=teafi
POSTGRES_PASSWORD=
POSTGRES_DB=teafi_bot
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# Redis
REDIS_PASSWORD=
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# Channels
REVIEW_CHANNEL_ID=
TASK_LOG_CHANNEL_ID=
WORK_CHANNEL_ID=
LOCAL_LEAD_CHANNEL_ID=

# Roles
ADMIN_ROLE_ID=
LOCAL_LEAD_ROLE_ID=
SPROUT_LEAF_ROLE_ID=
GREEN_LEAF_ROLE_ID=
GOLDEN_LEAF_ROLE_ID=

# Monthly Reward Pool
MONTHLY_POOL=600000

# AI Helper
AMB_CHAT_CHANNEL_ID=
OPENAI_API_KEY=
OPENAI_VECTOR_STORE_ID=

# Twitter
TWITTER_COOKIES=
```

---

## Production Deploy

**Server:** Hetzner VPS (`/opt/apps/teafi-bot/`)
**Server docs:** See `server-CLAUDE.md` for full Hetzner setup guide

### Quick Reference

```bash
# SSH to server
ssh hetzner

# Full deploy (order matters!)
cd /opt/apps/teafi-bot
git pull
docker compose build --no-cache
docker compose run --rm bot bun run db:migrate  # BEFORE up — schema must match code
docker compose up -d
docker compose logs -f --tail 50

# Deploy Discord commands (only when slash commands change)
docker compose run --rm bot bun run deploy

# Check status
docker ps --filter 'name=teafi'
```

### Docker Architecture
- **teafi-bot** — Bot container (Bun runtime, runs TypeScript directly)
- **teafi-postgres** — PostgreSQL 16 (port 5433 host-mapped)
- **teafi-redis** — Redis 7 with auth (port 6379)
- Isolated bridge network
- Non-root user (UID 1001), dumb-init, resource limits, health checks

### Important: No Bundling
This project does NOT use `bun build` — dynamic imports (`readdirSync` + `import()`) for commands/handlers are incompatible with bundling. The Dockerfile copies `src/` and runs TypeScript directly via Bun.
