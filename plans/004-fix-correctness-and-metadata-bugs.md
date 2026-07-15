# Plan 004: Fix correctness bugs (pollUser race, client redirect, stats calendar) and metadata

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7837eef..HEAD -- "src/app/(dashboard)/dashboard/layout.tsx" "src/app/(dashboard)/dashboard/library/page.tsx" "src/app/(dashboard)/dashboard/stats/route.ts" src/app/layout.tsx src/app/not-found.tsx`
> If any changed since commit `7837eef`, compare the "Current state" excerpts
> below against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (recommended after 001). **Plan 007 depends on this** —
  it clears 7 of the type errors that 007 needs gone.
- **Category**: bug
- **Planned at**: commit `7837eef`, 2026-07-15

## Why this matters

Four independent, small, low-risk defects:

- **pollUser race** — the dashboard layout provisions the local `User` row with
  a floating (un-awaited) promise, so on a brand-new user's first load the row
  may not be committed before child pages/actions insert rows that reference it,
  and any failure is an unhandled rejection.
- **`redirect()` in a click handler** — opening a library conversation calls
  `next/navigation`'s `redirect()` inside an async `onClick`; that function works
  by throwing `NEXT_REDIRECT`, which is not caught in a client event handler, so
  navigation is unreliable and logs an error. Every sibling uses `router.push`.
- **Stats calendar backfill is a no-op** — the loop that should fill zero-value
  days starts at "now", so the activity calendar only shows days that already
  have transactions, leaving gaps.
- **Broken metadata** — `metadataBase` throws if `NEXT_PUBLIC_BASE_URL` is unset,
  the OpenGraph block uses a `localhost` URL and the wrong `image` key (so no OG
  image is produced), and `not-found.tsx` sets tags via the Pages-Router
  `next/head`, which is a no-op in the App Router.

## Current state

### 1. `src/app/(dashboard)/dashboard/layout.tsx:24-29`
```ts
const { userId } = await auth()
if (userId) {
    pollUser({
        clerkId: userId
    })
}
```
`pollUser` (in `src/app/(auth)/auth/actions.ts`) upserts the local `User` row.

### 2. `src/app/(dashboard)/dashboard/library/page.tsx`
```ts
// line 16
import { redirect } from 'next/navigation'
// ...
// lines 101-116
const handleLibraryBook = async (id, bookId, bookTitle, bookAuthor, bookCover) => {
    const transactionId = await getBookTransaction(id, bookId, bookTitle, bookAuthor || 'Unknown Author', bookCover || '/images/book.jpg')
    redirect(`/dashboard/library/${transactionId}`)
}
```
This component does **not** currently import or use `useRouter`.

### 3. `src/app/(dashboard)/dashboard/stats/route.ts`
```ts
// line 185
const oneYearAgo = new Date()
oneYearAgo.setFullYear(now.getFullYear() - 1)
// ...
// lines 204-211  -- currentDate starts at ~now, so this loop runs ~0 times
const currentDate = new Date()
while (currentDate <= now) {
    const formattedDate = currentDate.toISOString().split('T')[0]
    if (!dateCountMap[formattedDate]) {
        calendarData.push({ day: formattedDate, value: 0 })
    }
    currentDate.setDate(currentDate.getDate() + 1)
}
```
`dateCountMap` (populated earlier, lines 191-198) contains only days that have
transactions.

### 4. `src/app/layout.tsx` (root metadata)
```ts
// line 35
metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL as string),
// lines 61-70
openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'localhost:3000',
    title: 'Gutenberg AI',
    description: '...',
    siteName: 'Gutenberg AI',
    image: '/logo.svg'          // wrong key — Next expects `images`
},
```
The `image` key is one of the 24 suppressed TypeScript errors
(`error TS2561 … Did you mean to write 'images'?`).

### 5. `src/app/not-found.tsx`
```ts
// line 6-7
import { Metadata } from 'next'   // imported, never used
import Head from 'next/head'      // Pages-Router API — no-op in App Router
// line 11
const [atoms, setAtoms] = useState<number[]>([])   // wrong type; set to objects
// lines 43-59: a <Head> block with meta/title tags that never render
```
The `useState<number[]>` vs object-array mismatch and the `atom.id/x/y/size`
accesses are 6 of the 24 suppressed TypeScript errors.

## Commands you will need

| Purpose        | Command                                    | Expected            |
|----------------|--------------------------------------------|---------------------|
| Typecheck      | `npx tsc --noEmit 2>&1 \| grep -E "not-found\|src/app/layout"` | no matches after this plan |
| Error count    | `npx tsc --noEmit 2>&1 \| grep -c "error TS"` | drops by 7          |
| Dev (smoke)    | `pnpm dev`                                  | server boots        |

## Scope

**In scope**:
- `src/app/(dashboard)/dashboard/layout.tsx`
- `src/app/(dashboard)/dashboard/library/page.tsx`
- `src/app/(dashboard)/dashboard/stats/route.ts`
- `src/app/layout.tsx`
- `src/app/not-found.tsx`

**Out of scope** (do NOT touch):
- `src/app/(auth)/auth/actions.ts` (`pollUser` itself is correct — only how it is
  called changes).
- Converting `not-found.tsx` to emit real 404 metadata via a server wrapper —
  deliberately deferred (see Maintenance notes). This plan only removes the dead
  `next/head` usage.
- The `image` remote-patterns config in `next.config.ts`.

## Git workflow

- Branch: `advisor/004-correctness-metadata`.
- Suggested commit: `fix: await user provisioning, use router.push, backfill stats calendar, correct metadata`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Await user provisioning in the dashboard layout

In `src/app/(dashboard)/dashboard/layout.tsx`, change the fire-and-forget call to
an awaited call guarded so a provisioning hiccup does not crash the layout:

```ts
if (userId) {
    try {
        await pollUser({ clerkId: userId })
    } catch (error) {
        console.error('pollUser failed:', error)
    }
}
```

**Verify**: `grep -n "await pollUser" "src/app/(dashboard)/dashboard/layout.tsx"` → one match.

### Step 2: Replace `redirect()` with `router.push()` in the library page

In `src/app/(dashboard)/dashboard/library/page.tsx`:
- Change the import on line 16 from `import { redirect } from 'next/navigation'`
  to `import { useRouter } from 'next/navigation'`.
- Inside the `LibraryPage` component body (near the top, alongside the other
  hooks), add `const router = useRouter()`.
- In `handleLibraryBook`, change `redirect(\`/dashboard/library/${transactionId}\`)`
  to `router.push(\`/dashboard/library/${transactionId}\`)`.

**Verify**:
- `grep -n "redirect(" "src/app/(dashboard)/dashboard/library/page.tsx"` → no match.
- `grep -n "useRouter\|router.push" "src/app/(dashboard)/dashboard/library/page.tsx"` → matches.

### Step 3: Fix the stats calendar backfill

In `src/app/(dashboard)/dashboard/stats/route.ts`, change the loop initializer so
it starts a year ago instead of now:

```ts
const currentDate = new Date(oneYearAgo)
```

(Everything else in the loop stays; it now iterates each day from one year ago to
now, pushing a zero entry for every day not already in `dateCountMap`.)

**Verify**: `grep -n "new Date(oneYearAgo)" "src/app/(dashboard)/dashboard/stats/route.ts"` → one match.

### Step 4: Fix the root OpenGraph / metadataBase

In `src/app/layout.tsx`:
- Line 35: replace with a guarded base URL (removes the crash-if-unset and the
  `as string` cast):
  ```ts
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  ```
- In the `openGraph` object: set
  `url: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'` and change
  the `image: '/logo.svg'` line to `images: '/logo.svg'`.

**Verify**:
- `grep -n "as string" src/app/layout.tsx` → no match.
- `grep -n "image:" src/app/layout.tsx` → no match; `grep -n "images:" src/app/layout.tsx` → one match.

### Step 5: Remove the dead `next/head` block and fix the particle type in not-found

In `src/app/not-found.tsx`:
- Remove `import { Metadata } from 'next'` (line 6) and `import Head from 'next/head'` (line 7).
- Define a type for the particles and use it for the state:
  ```ts
  type Atom = { id: number; x: number; y: number; size: number }
  const [atoms, setAtoms] = useState<Atom[]>([])
  ```
- Delete the entire `<Head>…</Head>` block (lines 43-59) and drop the wrapping
  fragment so the component returns the top-level `<div className="relative …">`
  directly.

**Verify**:
- `grep -n "next/head\|Metadata" src/app/not-found.tsx` → no match.
- `grep -n "useState<Atom\[\]>" src/app/not-found.tsx` → one match.

### Step 6: Confirm the type-error count dropped by 7

Run `npx tsc --noEmit 2>&1 | grep -E "not-found|src/app/layout.tsx"`.

**Verify**: no output (those 7 errors are resolved). The total
`npx tsc --noEmit 2>&1 | grep -c "error TS"` should be 7 lower than before this
plan.

## Test plan

- No automated tests (scaffold is Plan 006). If Plan 006 has landed, add a unit
  test for a small extracted helper only if you extract one — do not refactor
  the route for testability in this plan.
- **Manual smoke** (`pnpm dev`, `.env` required):
  1. Library page → click a book cover → navigates to the conversation (no
     console `NEXT_REDIRECT` error).
  2. Stats/dashboard activity calendar renders a continuous year (zero days
     filled, no gaps).
  3. App boots with `NEXT_PUBLIC_BASE_URL` **unset** without crashing on
     `metadataBase` (temporarily unset it to confirm, then restore).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "await pollUser" "src/app/(dashboard)/dashboard/layout.tsx"` → match.
- [ ] `grep -n "redirect(" "src/app/(dashboard)/dashboard/library/page.tsx"` → no match.
- [ ] `grep -n "new Date(oneYearAgo)" "src/app/(dashboard)/dashboard/stats/route.ts"` → match.
- [ ] `grep -n "images:" src/app/layout.tsx` → match; `grep -n "image:\|as string" src/app/layout.tsx` → no match.
- [ ] `grep -n "next/head" src/app/not-found.tsx` → no match.
- [ ] `npx tsc --noEmit 2>&1 | grep -E "not-found|src/app/layout.tsx"` → no output.
- [ ] `git status` shows only the 5 in-scope files changed.
- [ ] `plans/README.md` status row for 004 updated.

## STOP conditions

Stop and report (do not improvise) if:

- `pollUser` takes visibly long to await and blocks the dashboard render — report
  so we can decide between awaiting vs. a deliberate background mechanism.
- Removing the fragment/`<Head>` in not-found leaves unbalanced JSX you can't
  resolve — re-read the file and re-apply carefully.
- The `tsc` error count does not drop by exactly 7 (you either missed one or
  introduced a new error).

## Maintenance notes

- Deferred follow-up: to emit real 404 title/OG tags, split `not-found.tsx` into
  a server component exporting `metadata` plus a `'use client'` child for the
  animation. Not done here because the current tags never rendered anyway, so
  removing them is behavior-neutral and lower risk.
- Reviewer: confirm the stats calendar doesn't double-count — the fill loop only
  pushes days absent from `dateCountMap`, which holds only transaction days.
- If `NEXT_PUBLIC_BASE_URL` becomes required infrastructure, replace the
  `?? 'http://localhost:3000'` fallbacks with a validated env module.
