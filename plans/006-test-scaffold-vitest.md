# Plan 006: Establish a test baseline — Vitest + unit tests for the recommendation scoring

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7837eef..HEAD -- "src/app/(dashboard)/dashboard/books/recommendations.ts" package.json`
> If either changed since commit `7837eef`, compare the "Current state"
> excerpts below against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2 (verification enabler)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (recommended after 001)
- **Category**: tests
- **Planned at**: commit `7837eef`, 2026-07-15

## Why this matters

The repo has **zero automated tests** and no `test` script — the only check is
`next lint`, and `next.config.ts` disables typechecking at build. Every other
plan here has to lean on manual smoke tests. This plan installs a test runner and
writes the first real suite around the app's most intricate **pure** logic: the
recommendation scoring in `books/recommendations.ts`. To make that logic testable
without dragging in Prisma, Clerk, and the `server-only` gutenberg module, the
pure helpers are extracted into a plain module first (behavior-neutral).

## Current state

`src/app/(dashboard)/dashboard/books/recommendations.ts` is a `'use server'`
module. Lines **14–128** define pure, side-effect-free helpers used by the
server actions below them:
- `export interface RecommendedBook { id; title; author; coverUrl; score; reason }` (14–21)
- `const STOPWORDS = new Set([...])` (23–34)
- `function subjectTokens(subjects: string[]): Set<string>` (37–48)
- `function titleKey(title: string, author: string): string` (53–55)
- `interface RankOptions { preferredLanguages?; excludeTitleKeys? }` (57–63)
- `function scoreAndRank(candidates: NormalizedBook[], seedTokens, seedAuthors, excludeIds, options): RecommendedBook[]` (65–128)

The impure functions below (`popularBooks`, `fetchSimilarBooks`,
`getRecommendationsForProfile`, `fetchRecommendations`) call `subjectTokens`,
`titleKey`, `scoreAndRank`, and reference the `RecommendedBook` type.

`package.json` has **no test framework** and no `test` script. This is a pnpm
project.

## Commands you will need

| Purpose      | Command                | Expected             |
|--------------|------------------------|----------------------|
| Add dev dep  | `pnpm add -D vitest`   | exit 0               |
| Run tests    | `pnpm test`            | all tests pass       |
| Error count  | `npx tsc --noEmit 2>&1 \| grep -c "error TS"` | unchanged |

## Scope

**In scope**:
- `package.json` (add `vitest` dev dep + `test` script)
- `vitest.config.ts` (create)
- `src/lib/recommendation-utils.ts` (create — extracted pure helpers)
- `src/lib/recommendation-utils.test.ts` (create — the tests)
- `src/app/(dashboard)/dashboard/books/recommendations.ts` (import from the new
  module; delete the moved definitions)

**Out of scope** (do NOT touch):
- The impure functions in `recommendations.ts` (`popularBooks`,
  `fetchSimilarBooks`, `getRecommendationsForProfile`, `fetchRecommendations`) —
  keep their bodies exactly as-is; only their source of the helpers changes.
- Any component importing `RecommendedBook` — the re-export keeps that path valid.
- Mocking Prisma/Clerk to test server actions — a later, separate plan.

## Git workflow

- Branch: `advisor/006-test-scaffold`.
- Suggested commit: `test: add Vitest and unit tests for recommendation scoring`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install Vitest and add scripts

Run `pnpm add -D vitest`. Then add to the `scripts` block of `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Verify**: `pnpm test 2>&1 | head -5` runs Vitest (it will report "no test files
found" until Step 4 — that's expected here).

### Step 2: Create the Vitest config

Create `vitest.config.ts` at the repo root:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
})
```

**Verify**: file exists; `pnpm test` still runs without a config error.

### Step 3: Extract the pure helpers into a plain module

Create `src/lib/recommendation-utils.ts` with this exact content (it is the
verbatim logic from `recommendations.ts:14-128`, with `scoreAndRank` typed
against a local structural `RankableBook` so it needs no `server-only` import):

```ts
// Pure, side-effect-free recommendation scoring helpers, extracted from the
// server-action module so they can be unit-tested without pulling in Prisma,
// Clerk, or the `server-only` gutenberg module.

export interface RecommendedBook {
    id: number
    title: string
    author: string
    coverUrl: string
    score: number
    reason: string
}

// Minimal shape scoreAndRank reads. NormalizedBook (from @/lib/gutenberg) is
// structurally assignable to this.
export interface RankableBook {
    id: number
    title: string
    author: string
    coverUrl: string
    subjects: string[]
    languages: string[]
    downloadCount: number
}

const STOPWORDS = new Set([
    'fiction', 'the', 'of', 'and', 'a', 'in', 'to', 'for', 'stories', 'literature'
])

export function subjectTokens(subjects: string[]): Set<string> {
    const tokens = new Set<string>()
    for (const subject of subjects) {
        for (const part of subject.split(/--|,/)) {
            const token = part.trim().toLowerCase()
            if (token.length > 2 && !STOPWORDS.has(token)) {
                tokens.add(token)
            }
        }
    }
    return tokens
}

export function titleKey(title: string, author: string): string {
    return `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`
}

export interface RankOptions {
    preferredLanguages?: Set<string>
    excludeTitleKeys?: Set<string>
}

export function scoreAndRank(
    candidates: RankableBook[],
    seedTokens: Set<string>,
    seedAuthors: Set<string>,
    excludeIds: Set<number>,
    options: RankOptions = {}
): RecommendedBook[] {
    const { preferredLanguages, excludeTitleKeys } = options
    const byTitle = new Map<string, RecommendedBook>()

    for (const book of candidates) {
        if (excludeIds.has(book.id)) continue
        if (!book.coverUrl) continue

        if (
            preferredLanguages &&
            preferredLanguages.size > 0 &&
            book.languages.length > 0 &&
            !book.languages.some(l => preferredLanguages.has(l))
        ) {
            continue
        }

        const author = book.author || 'Unknown Author'
        const key = titleKey(book.title, author)
        if (excludeTitleKeys?.has(key)) continue

        const tokens = subjectTokens(book.subjects)
        let shared = 0
        for (const token of tokens) {
            if (seedTokens.has(token)) shared++
        }

        const sameAuthor = seedAuthors.has(author.toLowerCase())

        const score =
            shared * 2 +
            (sameAuthor ? 4 : 0) +
            Math.min(book.downloadCount / 50000, 1)

        if (score <= 0) continue

        const reason = sameAuthor
            ? `More by ${author}`
            : shared > 0
                ? 'Similar themes'
                : 'Popular pick'

        const existing = byTitle.get(key)
        if (existing && existing.score >= score) continue

        byTitle.set(key, {
            id: book.id,
            title: book.title,
            author,
            coverUrl: book.coverUrl,
            score: Math.round(score * 100) / 100,
            reason
        })
    }

    return Array.from(byTitle.values()).sort((a, b) => b.score - a.score)
}
```

### Step 4: Point `recommendations.ts` at the extracted module

In `src/app/(dashboard)/dashboard/books/recommendations.ts`:
- **Delete** the moved definitions: the `RecommendedBook` interface, `STOPWORDS`,
  `subjectTokens`, `titleKey`, `RankOptions`, and `scoreAndRank` (the block
  spanning the current lines 14–128). Leave the `'use server'` directive, the
  other imports, and everything from `popularBooks` downward untouched.
- Add these imports near the top (after the existing imports):
  ```ts
  import {
      scoreAndRank,
      subjectTokens,
      titleKey
  } from '@/lib/recommendation-utils'
  export type { RecommendedBook } from '@/lib/recommendation-utils'
  ```

**Verify**:
- `grep -n "function scoreAndRank\|function subjectTokens\|const STOPWORDS" "src/app/(dashboard)/dashboard/books/recommendations.ts"` → no matches.
- `grep -n "recommendation-utils" "src/app/(dashboard)/dashboard/books/recommendations.ts"` → two matches (import + type re-export).
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` did not increase versus before this plan.

### Step 5: Write the tests

Create `src/lib/recommendation-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { subjectTokens, titleKey, scoreAndRank, type RankableBook } from './recommendation-utils'

const base: RankableBook = {
    id: 1,
    title: 'Great Expectations',
    author: 'Charles Dickens',
    coverUrl: 'https://example.com/c.jpg',
    subjects: [],
    languages: ['en'],
    downloadCount: 0
}

describe('subjectTokens', () => {
    it('splits on -- and , and lowercases', () => {
        const t = subjectTokens(['England -- Fiction', 'Orphans, Children'])
        expect(t.has('england')).toBe(true)
        expect(t.has('orphans')).toBe(true)
        expect(t.has('children')).toBe(true)
    })
    it('drops stopwords and tokens of length <= 2', () => {
        const t = subjectTokens(['Fiction -- of -- to', 'AB -- Love'])
        expect(t.has('fiction')).toBe(false)
        expect(t.has('of')).toBe(false)
        expect(t.has('ab')).toBe(false)
        expect(t.has('love')).toBe(true)
    })
})

describe('titleKey', () => {
    it('normalizes case and whitespace', () => {
        expect(titleKey('  Moby Dick ', 'Herman MELVILLE')).toBe('moby dick::herman melville')
    })
})

describe('scoreAndRank', () => {
    it('drops candidates without a cover or in the exclude set', () => {
        const noCover = { ...base, id: 2, coverUrl: '' }
        const excluded = { ...base, id: 3, downloadCount: 100000 }
        const ok = { ...base, id: 4, downloadCount: 100000 }
        const out = scoreAndRank([noCover, excluded, ok], new Set(), new Set(), new Set([3]))
        expect(out.map(b => b.id)).toEqual([4])
    })

    it('boosts same-author and marks the reason', () => {
        const out = scoreAndRank(
            [{ ...base, id: 5 }],
            new Set(),
            new Set(['charles dickens']),
            new Set()
        )
        expect(out[0].reason).toBe('More by Charles Dickens')
        expect(out[0].score).toBeGreaterThanOrEqual(4)
    })

    it('rewards shared subject tokens with "Similar themes"', () => {
        const cand = { ...base, id: 6, author: 'Other', subjects: ['England -- Fiction'] }
        const out = scoreAndRank([cand], new Set(['england']), new Set(), new Set())
        expect(out[0].reason).toBe('Similar themes')
        expect(out[0].score).toBeGreaterThanOrEqual(2)
    })

    it('filters by preferred language', () => {
        const fr = { ...base, id: 7, author: 'X', languages: ['fr'], downloadCount: 100000 }
        const en = { ...base, id: 8, author: 'Y', languages: ['en'], downloadCount: 100000 }
        const out = scoreAndRank([fr, en], new Set(), new Set(), new Set(), {
            preferredLanguages: new Set(['en'])
        })
        expect(out.map(b => b.id)).toEqual([8])
    })

    it('dedupes editions by title+author, keeping the higher score', () => {
        const a = { ...base, id: 9, downloadCount: 10000 }
        const b = { ...base, id: 10, downloadCount: 100000 } // same title/author, higher downloads
        const out = scoreAndRank([a, b], new Set(), new Set(), new Set())
        expect(out).toHaveLength(1)
        expect(out[0].id).toBe(10)
    })
})
```

**Verify**: `pnpm test` → all tests pass (a suite of 7).

## Test plan

- The suite above is the deliverable. It covers: token splitting/stopwords,
  key normalization, cover/exclude filtering, same-author boost, theme overlap,
  language filtering, and edition dedupe.
- Pattern for future tests: co-locate `*.test.ts` next to the module; keep tested
  logic pure (extract from `'use server'`/`server-only` files as done here).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm test` exits 0 and reports the 7 tests passing.
- [ ] `vitest.config.ts` and `src/lib/recommendation-utils.ts` +
      `src/lib/recommendation-utils.test.ts` exist.
- [ ] `grep -n "function scoreAndRank" "src/app/(dashboard)/dashboard/books/recommendations.ts"` → no match.
- [ ] `npx tsc --noEmit 2>&1 | grep -c "error TS"` did not increase.
- [ ] `git status` shows only the in-scope files changed/created.
- [ ] `plans/README.md` status row for 006 updated.

## STOP conditions

Stop and report (do not improvise) if:

- After Step 4 the `tsc` error count increases (a moved symbol is still
  referenced from a deleted definition, or a component imported something you
  removed) — re-check the re-export and the deletion boundary.
- `pnpm test` fails on an assertion: do NOT weaken the test to make it pass.
  Compare the extracted `scoreAndRank` byte-for-byte against the original; a
  failing test means the extraction changed behavior. Fix the extraction.
- A component imports a *value* (not just the type) from `recommendations.ts`
  that you removed — report it.

## Maintenance notes

- This is the seed of the suite. High-value next targets: the stats aggregation
  in `stats/route.ts` (extract the message/keyword tallying into a pure function
  and test it), and the `fixUrl`/`normalize` logic in `gutenberg.ts`.
- Reviewer: confirm `recommendations.ts` behavior is unchanged — the extraction
  must be a pure move, and the `RecommendedBook` type must still be importable
  from `recommendations.ts` (the re-export) for existing consumers.
- Once this lands, wire `pnpm test` into CI so regressions are caught
  automatically (a follow-up, tracked with the typecheck gate in Plan 007).
