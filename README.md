# Gutenberg Explorer

## Overview

**Gutenberg Explorer** is a web app for discovering free public-domain books from
[Project Gutenberg](https://www.gutenberg.org/), with an AI assistant you can chat
with about any book. Browse thousands of titles, save them to a personal library,
get recommendations based on your taste, and ask an AI for plot summaries,
unusual-word explanations, language detection, and more.

Book metadata comes from the [Gutendex](https://gutendex.com/) API and is cached in
PostgreSQL, so the catalog stays fast and keeps working even when the upstream API
is slow or unavailable.

---

## Features

- **Browse & search** Project Gutenberg's catalog, backed by a Postgres cache for
  speed and resilience (serves cached results when Gutendex is down).
- **Personal library** — save books, mark favorites, and resume past conversations.
- **AI book chat** — ask questions about any book. Built-in conversation starters
  cover plot summaries, unusual words, and language detection. Powered by SambaNova
  (Llama 3.3 70B) through the OpenAI-compatible SDK, with per-user rate limiting.
- **Recommendations** — personalized picks from your library's subjects and authors,
  plus "similar books" on every book page.
- **Reading stats** — an activity calendar and reading insights on your dashboard.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) · React 19
- **Language:** TypeScript
- **Styling:** TailwindCSS · shadcn/ui
- **Auth:** Clerk
- **Database:** PostgreSQL (Neon) via Prisma
- **AI:** SambaNova (OpenAI-compatible SDK) — Llama 3.3 70B
- **Book data:** Project Gutenberg via the Gutendex API, cached in Postgres
- **Client data:** SWR · **Validation:** Zod
- **Testing:** Vitest · **CI:** GitHub Actions
- **Deployment:** Vercel

---

## Getting started

### Prerequisites

- Node.js 20+ (22 recommended)
- [pnpm](https://pnpm.io/)
- A PostgreSQL database — hosted (e.g. [Neon](https://neon.tech/)) or local via
  Docker (`./start-database.sh`)
- A [Clerk](https://clerk.com/) application (authentication)
- A [SambaNova](https://cloud.sambanova.ai/apis) API key (AI features)

### Setup

1. Clone and install:

   ```bash
   git clone https://github.com/0xHamzaDev/gutenberg-explorer.git
   cd gutenberg-explorer
   pnpm install
   ```

2. Create a `.env` file in the project root:

   ```env
   # Database (PostgreSQL)
   DATABASE_URL="postgresql://user:password@host:5432/dbname"

   # Clerk authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
   CLERK_SECRET_KEY="sk_..."

   # Base URL of the app
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"

   # SambaNova API key (used through the OpenAI-compatible SDK)
   OPENAI_API_KEY="your-sambanova-api-key"
   ```

   To run Postgres locally instead of a hosted DB, set `DATABASE_URL` to a local
   URL and run `./start-database.sh` (requires Docker).

3. Apply the database schema:

   ```bash
   pnpm db:push
   ```

4. (Optional) Warm the Gutenberg cache with popular books:

   ```bash
   node --env-file=.env scripts/prewarm-gutenberg-cache.mjs
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build (type-checked) |
| `pnpm start` | Run the production build |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm lint` | Lint with ESLint |
| `pnpm db:push` | Push the Prisma schema to the database |
| `pnpm db:studio` | Open Prisma Studio |

CI (GitHub Actions, `.github/workflows/ci.yml`) runs typecheck and tests on every
push and pull request to `main`.

---

## Usage

- **Explore:** search by title or author, then open any book to see its details.
- **Library:** add books to your library and favorite the ones you love.
- **Chat:** open a book conversation and ask the AI about it, or tap a starter
  prompt (plot summary, unusual words, language).
- **Discover:** browse the recommendations on your dashboard and the "similar
  books" on each book page.

---

## Contributing

Contributions are welcome:

1. Fork the repository.
2. Create a branch (`git checkout -b feature-name`).
3. Make your changes and commit them.
4. Push to your branch and open a pull request.

Before opening a PR, make sure `pnpm typecheck` and `pnpm test` pass.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file
for details.
