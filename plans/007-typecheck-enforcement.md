# Plan 007: Fix the remaining TypeScript errors and turn typechecking back on

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `npx tsc --noEmit 2>&1 | grep "error TS"`
> This plan was written against the error set at commit `7837eef`. **Run tsc
> first and work from the LIVE list**, not a memorized one — Plans 001 and 004
> (and possibly 002's React 19 types upgrade) change which errors remain. The
> fixes below cover the known errors; if the live list contains an error not
> addressed here, fix it following the same patterns or STOP if unclear.

## Status

- **Priority**: P2 (DX / correctness — removes the mask over real bugs)
- **Effort**: M
- **Risk**: MED (touches an auth flow and shared UI primitives)
- **Depends on**: **001** (removes `src/lib/auth.ts` → 6 errors) and **004**
  (fixes `layout.tsx` + `not-found.tsx` → 7 errors). Strongly recommended to run
  **last**, after 002/003/005/006, so their edits are already type-clean.
- **Category**: dx
- **Planned at**: commit `7837eef`, 2026-07-15

## Why this matters

`next.config.ts` sets `typescript.ignoreBuildErrors: true`, so `next build`
never fails on type errors and there is no `typecheck` script. At `7837eef` that
mask hides **24** real TypeScript errors — several are latent runtime bugs
(Next 15 async `params` read synchronously; a Clerk email-link API mismatch; UI
button variants referenced but undefined). Until typechecking is enforced, every
future change can silently reintroduce this class of bug. Plans 001 and 004
clear 13 of the 24; this plan clears the remaining 11, adds a `typecheck`
script, and removes the `ignoreBuildErrors` escape hatch.

## Current state — the 11 errors this plan owns

(After 001 + 004. Numbers are the current line locations at `7837eef`.)

1. `src/app/api/transactions/[transactionId]/route.ts:6-7,19` — Next 15 route
   `params` is a `Promise`, read synchronously.
2. `src/app/(dashboard)/dashboard/library/actions.ts:159,222` — `.choices` on the
   `ChatCompletion | Stream` union returned by `createChatCompletion` (root cause
   is `src/lib/ai.ts`).
3. `src/components/custom/navigation/header.tsx:74` — `variant="user"` not defined
   in `buttonVariants`.
4. `src/components/custom/navigation/navigation-mobile.tsx:65` — `variant="navbarIcon"`
   not defined in `buttonVariants`.
5. `src/components/app-sidebar.tsx:139,174` — `alt={user?.firstName}` is
   `string | null | undefined`; the prop wants `string | undefined`.
6. `src/app/(auth)/auth/sign-in/page.tsx:95` — `emailAddressId` not on the
   `SignInFirstFactor` union returned by `.find(...)`.
7. `src/app/(auth)/auth/sign-in/page.tsx:100` — `strategy` is not a valid key of
   `SignInStartEmailLinkFlowParams`.
8. `tailwind.config.ts:16` — `center: 'true'` (string) should be boolean.
9. `.next/types/.../books/[bookId]/page.ts` — the page file exports a non-page
   symbol (`GutenbergBookOverview`).
10. `src/components/providers/scroll-provider.tsx:14` — a **duplicate `@types/react`**
    error (React 18 vs 19). `@studio-freight/react-lenis` hard-depends on
    `@types/react@^18`, so `ReactLenis`'s `children` (typed v18) rejects the app's
    v19 `ReactNode`. Surfaced by the Plan 002 React-19 upgrade. Also note the
    knock-on `.next/types/validator.ts` error, which is resolved automatically by
    fixing the route `params` (Step 2).

## Commands you will need

| Purpose      | Command                | Expected                     |
|--------------|------------------------|------------------------------|
| Typecheck    | `npx tsc --noEmit`     | exit 0 by the end of this plan |
| Error list   | `npx tsc --noEmit 2>&1 \| grep "error TS"` | shrinks to empty |
| Build        | `pnpm build`           | exit 0 (needs `.env`)        |
| Tests        | `pnpm test`            | pass (if 006 landed)         |

## Scope

**In scope**:
- `src/lib/ai.ts`
- `src/app/api/transactions/[transactionId]/route.ts`
- `src/components/ui/button.tsx`
- `src/components/app-sidebar.tsx`
- `src/app/(auth)/auth/sign-in/page.tsx`
- `tailwind.config.ts`
- `src/app/(dashboard)/dashboard/books/[bookId]/page.tsx` (remove one `export`)
- `next.config.ts` (remove `ignoreBuildErrors`)
- `package.json` (add `typecheck` script; add `pnpm.overrides` for `@types/react*`)
- The 10 files with bare `: JSX.Element` annotations listed in Step 7c
  (annotation removal only)

**Out of scope** (do NOT touch):
- Behavior of the sign-in flow beyond the two minimal type fixes below. Do NOT
  restructure the auth logic.
- `layout.tsx` / `not-found.tsx` — owned by Plan 004; if their errors still show,
  Plan 004 has not landed — STOP and note the dependency.
- `src/lib/auth.ts` — should already be deleted by Plan 001; if it still exists,
  STOP (run 001 first).

## Git workflow

- Branch: `advisor/007-typecheck`.
- Suggested commit: `fix(types): resolve TS errors and enforce typechecking in build`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

Run `npx tsc --noEmit 2>&1 | grep "error TS"` before starting and after each step
to watch the count fall.

### Step 1: Force the non-streaming OpenAI overload in `ai.ts`

In `src/lib/ai.ts`:
- Remove `stream?: boolean` from the `ChatCompletionParams` interface.
- Annotate the return type and pass `stream: false` so the SDK resolves the
  non-streaming overload:
  ```ts
  export async function createChatCompletion(
      params: ChatCompletionParams
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
      if (!isApiKeyConfigured) {
          throw new Error(
              'AI service is not configured. Please add your SambaNova API key to the environment variables.'
          )
      }
      try {
          const response = await openai.chat.completions.create({
              ...params,
              stream: false
          })
          return response
      } catch (error: any) {
          // ...unchanged...
      }
  }
  ```

**Verify**: `npx tsc --noEmit 2>&1 | grep "library/actions.ts"` → no `.choices`
errors.

### Step 2: Await route `params` (Next 15)

In `src/app/api/transactions/[transactionId]/route.ts`:
```ts
export async function GET(
    request: Request,
    { params }: { params: Promise<{ transactionId: string }> }
) {
    try {
        const { userId } = await auth()
        // ...unchanged...
        const { transactionId } = await params
        // ...use transactionId (replaces `const transactionId = params.transactionId`)
```

**Verify**: `npx tsc --noEmit 2>&1 | grep "route.ts"` → no error; `grep -n "await params" "src/app/api/transactions/[transactionId]/route.ts"` → match.

### Step 3: Add the missing button variants

In `src/components/ui/button.tsx`, inside the `variant` map of `buttonVariants`
(after `link`), add two behavior-neutral variants (empty class strings preserve
the current rendering, which today falls through to base styles):
```ts
link: 'text-primary underline-offset-4 hover:underline',
user: '',
navbarIcon: ''
```

**Verify**: `npx tsc --noEmit 2>&1 | grep -E "header.tsx|navigation-mobile.tsx"`
→ no `variant` errors.

### Step 4: Coerce nullable `alt` in the sidebar

In `src/components/app-sidebar.tsx`, at both `AvatarImage` usages (lines ~139 and
~174), change `alt={user?.firstName}` to `alt={user?.firstName ?? undefined}`.

**Verify**: `npx tsc --noEmit 2>&1 | grep "app-sidebar.tsx"` → no error.

### Step 5: Fix the Clerk email-link typing (minimal, behavior-preserving)

In `src/app/(auth)/auth/sign-in/page.tsx`:
- Line ~95: replace `const { emailAddressId } = ff` with a safe narrowing:
  ```ts
  const emailAddressId =
      'emailAddressId' in ff ? (ff.emailAddressId as string) : undefined
  if (!emailAddressId) return
  ```
- Line ~100: remove `strategy: 'email_link'` from the `startEmailLinkFlow(...)`
  argument object (that param is not part of `SignInStartEmailLinkFlowParams`;
  the flow is already an email-link flow). The call becomes:
  ```ts
  const res = await startEmailLinkFlow({
      emailAddressId,
      redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email`
  })
  ```

If you are unsure whether these match your installed `@clerk/nextjs` version,
consult the Clerk docs (via the `context7` tool if available, library
`@clerk/nextjs`) before changing — and if still unclear, STOP and report rather
than guess at auth behavior.

**Verify**: `npx tsc --noEmit 2>&1 | grep "sign-in/page.tsx"` → no error.

### Step 6: Fix the tailwind container config

In `tailwind.config.ts:16`, change `center: 'true'` to `center: true`.

**Verify**: `npx tsc --noEmit 2>&1 | grep "tailwind.config.ts"` → no error.

### Step 7: Stop the page file from exporting a non-page symbol

In `src/app/(dashboard)/dashboard/books/[bookId]/page.tsx`, first confirm the
symbol is only used within this file:
`grep -rn "GutenbergBookOverview" src/ | grep -v "books/\[bookId\]/page.tsx"`
→ if that prints anything, STOP (it's imported elsewhere). Otherwise remove the
`export` keyword from `export function GutenbergBookOverview(` (make it
`function GutenbergBookOverview(`). It is only rendered by `Preview` in the same
file.

**Verify**: `npx tsc --noEmit 2>&1 | grep "books/\[bookId\]/page"` → no error.

### Step 7b: Deduplicate `@types/react` to clear the scroll-provider error

The `scroll-provider.tsx:14` error comes from two `@types/react` versions coexisting
(`@studio-freight/react-lenis` pins `@types/react@^18`). Force a single v19 across
the tree with a dev-only override. Add a `pnpm` block to `package.json` (top level,
sibling of `scripts`/`dependencies`):
```json
"pnpm": {
    "overrides": {
        "@types/react": "^19",
        "@types/react-dom": "^19"
    }
}
```
Then run `pnpm install`. This is a **types-only** dedupe (no runtime effect) — it is
the intended fix for a dual-`@types/react` tree and does not force-resolve any
runtime peer.

**Verify**:
- `pnpm install` → exit 0.
- `find node_modules/.pnpm -maxdepth 1 -name "@types+react@18*" -type d` → no output
  (the v18 copy is gone).
- `npx tsc --noEmit 2>&1 | grep "scroll-provider"` → no output.

### Step 7c: Drop the bare `JSX.Element` return annotations (React 19 fallout)

Deduping `@types/react` to v19 in Step 7b removes the v18 global-`JSX`-namespace
shim that `@studio-freight/react-lenis` was transitively supplying. React 19
**removed the global `JSX` namespace** (it's now `React.JSX`), so 10 component
signatures that used a bare `: JSX.Element` return annotation surface as
`error TS2503: Cannot find namespace 'JSX'`. Fix minimally by **removing the
`: JSX.Element` annotation** from each (let TypeScript infer — no React import or
`React.JSX.Element` rewrite needed):

- `src/app/(landing)/_components/tech-section.tsx` (`TechSection`)
- `src/app/(landing)/terms/page.tsx` (`TermsPage`)
- `src/app/(landing)/policy/page.tsx` (`PolicyPage`)
- `src/app/(dashboard)/dashboard/settings/page.tsx` (`SettingsPage`)
- `src/app/(dashboard)/dashboard/library/page.tsx` (`LibraryPage`)
- `src/app/(dashboard)/dashboard/library/[transactionId]/page.tsx` (`ChatPage`)
- `src/app/(dashboard)/dashboard/books/page.tsx` (`BooksPage`)
- `src/components/custom/navigation/navigation-mobile.tsx` (`}: MobileLinkProps): JSX.Element {` → `}: MobileLinkProps) {`)
- `src/components/custom/navigation/header.tsx` (`Header`)
- `src/components/custom/navigation/navigation.tsx` (`Navigation`)

**Verify**: `grep -rn ": JSX.Element" src/` → no output.

### Step 8: Add the typecheck script and remove the build escape hatch

- In `package.json` `scripts`, add: `"typecheck": "tsc --noEmit"`.
- In `next.config.ts`, delete the block:
  ```ts
  typescript: {
      ignoreBuildErrors: true
  },
  ```

**Verify**:
- `npx tsc --noEmit` → exit 0, **zero** errors.
- `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0 (with `.env` present). The build now enforces types.

## Test plan

- Verification is the type checker itself plus a green build. If Plan 006 landed,
  run `pnpm test` and confirm it still passes.
- **Manual smoke** (`pnpm dev`, `.env` required): exercise the email-link sign-in
  once end to end (enter an email, receive the link) to confirm Step 5 did not
  regress the flow. If you cannot receive email in this environment, note that
  the sign-in change is verified by type only and flag it for the reviewer.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `0`.
- [ ] `pnpm typecheck` exists as a script and exits 0.
- [ ] `grep -n "ignoreBuildErrors" next.config.ts` → no match.
- [ ] `pnpm build` exits 0 with `.env` present.
- [ ] `grep -n "await params" "src/app/api/transactions/[transactionId]/route.ts"` → match.
- [ ] `git status` shows only in-scope files changed.
- [ ] `plans/README.md` status row for 007 updated.

## STOP conditions

Stop and report (do not improvise) if:

- `src/lib/auth.ts` still exists or `layout.tsx`/`not-found.tsx` errors still
  appear (Plans 001/004 have not landed — run them first).
- Step 7's guard grep shows `GutenbergBookOverview` imported by another file.
- Step 5's Clerk types don't match your installed version and the correct API is
  unclear — do not guess at an auth flow.
- After Step 8, `pnpm build` fails on an error you cannot trace to one of the
  fixes above (a new error surfaced, likely from the React 19 types upgrade in
  Plan 002) — capture it and report.

## Maintenance notes

- Once green, wire `pnpm typecheck` and `pnpm test` into CI so this can't rot
  again. The `user`/`navbarIcon` button variants are intentionally empty
  (behavior-neutral); a reviewer/designer can give them real styles later.
- The Clerk sign-in fix is the riskiest change here — the reviewer should
  confirm the email-link flow still works against the live Clerk project.
- Keep `ignoreBuildErrors` out. If a future dependency bump introduces type
  errors, fix them rather than re-adding the flag.
