# Plan 003: Close the IDOR and add auth to the AI-proxy server actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7837eef..HEAD -- "src/app/(dashboard)/dashboard/library/actions.ts" "src/app/(dashboard)/dashboard/library/[transactionId]/page.tsx"`
> If either changed since commit `7837eef`, compare the "Current state"
> excerpts below against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1 (security)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent; recommended after 001)
- **Category**: security
- **Planned at**: commit `7837eef`, 2026-07-15

## Why this matters

Two authorization holes live in `src/app/(dashboard)/dashboard/library/actions.ts`:

1. **IDOR** — `getBookTransactionDataById(id)` looks up a transaction by id with
   **no ownership check** (`findUnique({ where: { id } })`) and returns the full
   row, including the entire chat `messages` array and the owner's `userId`. Any
   authenticated user who supplies another user's transaction id reads that
   user's private book conversation. Every *other* path in the codebase that
   reads a transaction filters by `userId` (see
   `src/app/api/transactions/[transactionId]/route.ts` and
   `getTransactionMessagesCached` in `message-actions.ts`) — this function is the
   lone exception.
2. **Unauthenticated LLM proxy** — `summarizeContent`, `getAIResponse`, and
   `getBookContent` are `'use server'` exports with **no `auth()` check** (unlike
   every mutation in the same file). `getAIResponse`/`summarizeContent` forward
   fully caller-controlled text to the paid SambaNova model using the server's
   API key. Because a Server Action's id can be POSTed to *any* route including
   public ones, the middleware gate is not a reliable backstop — the action must
   check identity itself. The impact is unbounded model spend billed to the
   project owner.

Fixing both is a handful of lines and matches the ownership pattern already used
elsewhere in the repo.

## Current state

`src/app/(dashboard)/dashboard/library/actions.ts` already imports `auth`:

```ts
// line 3
import { auth } from '@clerk/nextjs/server'
```

The vulnerable IDOR function (lines 64–76):

```ts
export const getBookTransactionDataById = unstable_cache(
    async (id: string) => {
        const transaction = await prisma.transactions.findUnique({
            where: {
                id: id
            }
        })
        return transaction
    },
    ['transaction-by-id'],
    { revalidate: 60 }
)
```

The correct pattern to mirror — the auth-wrapper + cached-inner split already
used in `src/app/(dashboard)/dashboard/library/message-actions.ts` (the cached
function takes `userId` and filters on it; a thin exported wrapper calls `auth()`
first):

```ts
export const getTransactionMessagesCached = unstable_cache(
    async (transactionId: string, userId: string) => {
        const transaction = await prisma.transactions.findFirst({
            where: { id: transactionId, userId }
        })
        // ...
    },
    ['transaction-messages'],
    { revalidate: 30 }
)
export async function getTransactionMessages(transactionId: string) {
    const { userId } = await auth()
    if (!userId) return []
    return getTransactionMessagesCached(transactionId, userId)
}
```

The three unguarded AI actions (current signatures, same file):
- `export const summarizeContent = async (bookContent: string): Promise<string>` (line 137)
- `export const getBookContent = async (bookId: string): Promise<string>` (line 174)
- `export const getAIResponse = async (userMessage: string, bookContent: string): Promise<string>` (line 196)

The single caller of `getBookTransactionDataById` is
`src/app/(dashboard)/dashboard/library/[transactionId]/page.tsx:250`:

```ts
const bookTransactionData = await getBookTransactionDataById(transactionId as string)
setBookData(bookTransactionData as BookData)
```

That page already renders `<InvalidChatPage />` when `bookData` is null
(`if (!transactionId || !bookData) return <InvalidChatPage />`), so returning
`null` for a non-owned transaction is handled gracefully with no caller change.

## Commands you will need

| Purpose        | Command                                            | Expected           |
|----------------|----------------------------------------------------|--------------------|
| Install        | `pnpm install`                                     | exit 0             |
| Typecheck file | `npx tsc --noEmit`                                 | no *new* errors (see note) |
| Grep           | `grep -n "findUnique\|await auth()" "src/app/(dashboard)/dashboard/library/actions.ts"` | as specified |

Typecheck note: the project has pre-existing suppressed TS errors. Compare the
error count before and after your change with
`npx tsc --noEmit 2>&1 | grep -c "error TS"` — it must not increase.

## Scope

**In scope** (the only file you should modify):
- `src/app/(dashboard)/dashboard/library/actions.ts`

**Out of scope** (do NOT touch):
- `.../library/[transactionId]/page.tsx` — the exported function keeps the same
  `(id: string)` signature, so the caller needs no change. Do not edit it.
- `src/lib/ai.ts` — its return-type typing is Plan 007's job.
- `message-actions.ts` — already correctly guarded; use it only as the pattern.
- Do NOT change the public return *shape* of `getBookTransactionDataById`
  (still a transaction or null) — only who is allowed to receive it.

## Git workflow

- Branch: `advisor/003-authz-fixes`.
- Suggested commit: `fix(security): enforce ownership on transaction lookup and auth on AI actions`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `getBookTransactionDataById` ownership-scoped

Replace the current `getBookTransactionDataById` export (lines 64–76) with a
cached inner function keyed on `id` **and** `userId`, plus a thin exported
wrapper that resolves the caller's identity first. Keep the exported name and
its `(id: string)` signature unchanged:

```ts
const getBookTransactionDataByIdCached = unstable_cache(
    async (id: string, userId: string) => {
        return prisma.transactions.findFirst({
            where: { id, userId }
        })
    },
    ['transaction-by-id'],
    { revalidate: 60 }
)

export async function getBookTransactionDataById(id: string) {
    const { userId } = await auth()
    if (!userId) return null
    return getBookTransactionDataByIdCached(id, userId)
}
```

(Using `findFirst` with the composite `where` is required because `findUnique`
only accepts unique keys; `id` alone is unique but we must also constrain
`userId` — `findFirst` is the correct call, matching `message-actions.ts`.)

**Verify**:
- `grep -n "findUnique" "src/app/(dashboard)/dashboard/library/actions.ts"` →
  no match (the unguarded lookup is gone).
- `grep -n "getBookTransactionDataByIdCached" "src/app/(dashboard)/dashboard/library/actions.ts"`
  → the new inner function exists.

### Step 2: Guard `getBookContent`

Add an identity check as the first statement inside `getBookContent` (before the
`try`). An unauthenticated caller gets the same empty-string result the function
already returns on failure:

```ts
export const getBookContent = async (bookId: string): Promise<string> => {
    const { userId } = await auth()
    if (!userId) return ''
    try {
        // ...unchanged...
```

**Verify**: `grep -n "await auth()" "src/app/(dashboard)/dashboard/library/actions.ts"`
now lists a line inside `getBookContent`.

### Step 3: Guard `summarizeContent` and `getAIResponse`

Add an identity check as the first statement of each (before any other work).
These return model output to an authenticated UI, so an unauthenticated caller
should be rejected outright:

```ts
export const summarizeContent = async (bookContent: string): Promise<string> => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const truncatedContent = truncateContent(bookContent, MAX_SUMMARY_LENGTH)
    // ...unchanged...
```

```ts
export const getAIResponse = async (
    userMessage: string,
    bookContent: string
): Promise<string> => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    try {
        // ...unchanged...
```

The existing client caller (`handleSendMessage` in the transaction page) already
wraps these in try/catch and shows a fallback message, so a thrown `Unauthorized`
degrades cleanly for the (impossible-in-normal-flow) unauthenticated case.

**Verify**: `grep -c "await auth()" "src/app/(dashboard)/dashboard/library/actions.ts"`
increases by 3 relative to before this plan (one each in `getBookContent`,
`summarizeContent`, `getAIResponse`), on top of the ones already present in
`getBookTransaction`, `getUserLibrary`, `toggleBookFavorite`, and the new wrapper.

### Step 4: Typecheck did not regress

Run `npx tsc --noEmit 2>&1 | grep -c "error TS"` and confirm the count did not
increase versus before your edits.

**Verify**: error count unchanged (or lower).

## Test plan

- No unit test is added here (server actions depend on Clerk `auth()` + Prisma;
  the reusable test scaffold arrives in Plan 006). If Plan 006 has landed,
  add a test asserting `getBookTransactionDataByIdCached` filters on `userId`
  (query the mocked Prisma and assert the `where` includes `userId`).
- **Manual verification (required)** with two accounts, once the app runs:
  1. As user A, open a book conversation and note its transaction id from the
     URL `/dashboard/library/<id>`.
  2. As user B (different session), navigate to `/dashboard/library/<A's id>`.
     Expected: the "Conversation Not Found" page (`InvalidChatPage`), NOT user
     A's book/messages.
  3. As user A, the same conversation still loads normally.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "findUnique" "src/app/(dashboard)/dashboard/library/actions.ts"`
      → no matches.
- [ ] The exported `getBookTransactionDataById` calls `auth()` and delegates to a
      `userId`-scoped cached function.
- [ ] `getBookContent`, `summarizeContent`, and `getAIResponse` each call
      `await auth()` before doing any work.
- [ ] `npx tsc --noEmit 2>&1 | grep -c "error TS"` did not increase.
- [ ] Manual two-account check: user B gets "Conversation Not Found" for user A's
      transaction id.
- [ ] `git status` shows only `library/actions.ts` changed.
- [ ] `plans/README.md` status row for 003 updated.

## STOP conditions

Stop and report (do not improvise) if:

- The caller page needs editing to make this work (it should not — the exported
  signature is unchanged). If it does, your Step 1 signature drifted; re-check.
- `npx tsc` shows a new error after your change.
- You find another exported reader of `prisma.transactions` without a `userId`
  filter beyond the ones named here — report it (possible additional IDOR).

## Maintenance notes

- Follow-up (deliberately out of scope): even with auth, an authenticated user
  can still drive LLM cost. Consider per-user rate limiting on `getAIResponse` /
  `summarizeContent` (e.g. a token-bucket keyed on `userId`) as a separate
  hardening plan. Note the dead `RATE_LIMIT_DELAY` constant is removed in
  Plan 001 — real limiting is a future plan, not that constant.
- Reviewer should scrutinize that the `unstable_cache` key now varies by
  `userId` (it does, because `userId` is a function argument and `unstable_cache`
  includes arguments in its key) — otherwise one user's cached result could be
  served to another.
- Any new endpoint or action that reads user-owned rows must filter by `userId`;
  treat `message-actions.ts` as the canonical pattern.
