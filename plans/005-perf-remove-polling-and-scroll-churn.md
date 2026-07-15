# Plan 005: Stop the 10s library-status polling and the header scroll-listener churn

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7837eef..HEAD -- "src/app/(dashboard)/dashboard/books/[bookId]/page.tsx" src/components/custom/navigation/header.tsx`
> If either changed since commit `7837eef`, compare the "Current state"
> excerpts below against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (recommended after 001)
- **Category**: perf
- **Planned at**: commit `7837eef`, 2026-07-15

## Why this matters

Two wasteful client behaviors:

- The book-detail page revalidates "is this book in my library" **every 10
  seconds** via SWR `refreshInterval`, and rotates the SWR key with `Date.now()`
  on every add/remove, forcing an extra DB round-trip. Membership changes only
  via the button on that same page, which already updates the value optimistically
  — so the polling and key-rotation are pure waste (a DB query 6×/min per open
  book page, indefinitely).
- The landing header's scroll effect depends on `lastScrollY` **state** and sets
  that state inside the scroll handler, so every scroll tick tears down and
  re-attaches the listener and re-renders the component.

Both are small, isolated fixes with no behavior change beyond removing the waste.

## Current state

### 1. `src/app/(dashboard)/dashboard/books/[bookId]/page.tsx`
```ts
// lines 71-73
const [libraryStatusKey, setLibraryStatusKey] = useState(
    `library-status-${bookId}-0`
)
// lines 84-102
const { data: inLibrary = false, mutate: refreshLibraryStatus } = useSWR(
    libraryStatusKey,
    async () => {
        try {
            const status = await isBookInLibrary(bookId)
            return status
        } catch (error) {
            return false
        }
    },
    {
        revalidateOnFocus: true,
        dedupingInterval: 0,
        revalidateIfStale: true,
        revalidateOnMount: true,
        refreshInterval: 10 * 1000,
        errorRetryCount: 3
    }
)
// line 150 (inside handleBookStatus, after the add/remove branch)
setLibraryStatusKey(`library-status-${bookId}-${Date.now()}`)
```
The add/remove branches already call `refreshLibraryStatus(false, false)` (line
111) and `refreshLibraryStatus(true, false)` (line 134) to set the value
optimistically without revalidating.

### 2. `src/components/custom/navigation/header.tsx:26-45`
```ts
const [isVisible, setIsVisible] = useState(true)
const [lastScrollY, setLastScrollY] = useState(0)

useEffect(() => {
    const handleScroll = () => {
        const currentScrollY = window.scrollY
        if (currentScrollY > lastScrollY) {
            setIsVisible(false)
        } else {
            setIsVisible(true)
        }
        setLastScrollY(currentScrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
}, [lastScrollY])
```
Import line 3: `import { useState, useEffect } from 'react'`.

## Commands you will need

| Purpose        | Command                    | Expected            |
|----------------|---------------------------|---------------------|
| Error count    | `npx tsc --noEmit 2>&1 \| grep -c "error TS"` | unchanged by this plan |
| Dev (smoke)    | `pnpm dev`                | server boots        |

## Scope

**In scope**:
- `src/app/(dashboard)/dashboard/books/[bookId]/page.tsx`
- `src/components/custom/navigation/header.tsx`

**Out of scope** (do NOT touch):
- `src/components/ui/button.tsx` and the `variant="user"` usage on
  `header.tsx:74` — the missing button variant is Plan 007's job. Only the scroll
  effect (lines 26-45) changes here.
- `isBookInLibrary` / the server actions in `books/actions.ts` — no change.
- Converting these pages to server components — that is a separate, larger effort
  (tracked as a deferred direction item, not this plan).

## Git workflow

- Branch: `advisor/005-perf-polling-scroll`.
- Suggested commit: `perf: drop 10s library-status polling and header scroll-listener churn`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Use a stable SWR key and stop polling on the book page

In `src/app/(dashboard)/dashboard/books/[bookId]/page.tsx`:
- Delete the `libraryStatusKey` state (lines 71-73).
- Change the `useSWR` first argument from `libraryStatusKey` to the stable string
  `` `library-status-${bookId}` ``.
- Replace the options object with the minimal, non-polling set:
  ```ts
  {
      revalidateOnFocus: false,
      errorRetryCount: 3
  }
  ```
- Delete the `setLibraryStatusKey(...)` call (line 150). The optimistic
  `refreshLibraryStatus(true/false, false)` calls already keep `inLibrary`
  correct after add/remove.

**Verify**:
- `grep -n "refreshInterval\|libraryStatusKey\|Date.now()" "src/app/(dashboard)/dashboard/books/[bookId]/page.tsx"` → no matches.
- `grep -n "library-status-\${bookId}\`" "src/app/(dashboard)/dashboard/books/[bookId]/page.tsx"` → the stable key is used.

### Step 2: Move `lastScrollY` to a ref in the header

In `src/components/custom/navigation/header.tsx`:
- Add `useRef` to the React import (line 3):
  `import { useState, useEffect, useRef } from 'react'`.
- Replace `const [lastScrollY, setLastScrollY] = useState(0)` with
  `const lastScrollY = useRef(0)`.
- In the handler, read `lastScrollY.current` and, at the end, set
  `lastScrollY.current = currentScrollY` (instead of `setLastScrollY`).
- Change the effect dependency array from `[lastScrollY]` to `[]`.

Resulting effect:
```ts
const lastScrollY = useRef(0)

useEffect(() => {
    const handleScroll = () => {
        const currentScrollY = window.scrollY
        if (currentScrollY > lastScrollY.current) {
            setIsVisible(false)
        } else {
            setIsVisible(true)
        }
        lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

**Verify**:
- `grep -n "setLastScrollY\|useState(0)" src/components/custom/navigation/header.tsx` → no matches.
- `grep -n "useRef(0)" src/components/custom/navigation/header.tsx` → one match.
- `grep -n "}, \[\])" src/components/custom/navigation/header.tsx` → the effect deps are empty.

### Step 3: Confirm no type regression

Run `npx tsc --noEmit 2>&1 | grep -c "error TS"`.

**Verify**: the count is unchanged versus before this plan (this plan does not fix
or add any type error; the pre-existing `variant="user"` error on `header.tsx:74`
remains for Plan 007).

## Test plan

- No automated tests (scaffold is Plan 006). Verification is manual.
- **Manual smoke** (`pnpm dev`):
  1. Open a book detail page; in the browser Network tab confirm there is **no**
     recurring `isBookInLibrary` request every 10s.
  2. Click "Add to Library" → button reflects added state immediately; refresh →
     still shows as in-library (persisted). Remove → reflects immediately.
  3. Scroll the landing page up and down → the header hides on scroll-down and
     shows on scroll-up as before (behavior unchanged).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "refreshInterval\|libraryStatusKey\|Date.now()" "src/app/(dashboard)/dashboard/books/[bookId]/page.tsx"` → no matches.
- [ ] `grep -n "setLastScrollY" src/components/custom/navigation/header.tsx` → no matches.
- [ ] `grep -n "useRef(0)" src/components/custom/navigation/header.tsx` → one match.
- [ ] `npx tsc --noEmit 2>&1 | grep -c "error TS"` unchanged from before this plan.
- [ ] `git status` shows only the 2 in-scope files changed.
- [ ] `plans/README.md` status row for 005 updated.

## STOP conditions

Stop and report (do not improvise) if:

- After Step 1 the add/remove button no longer reflects state changes (the
  optimistic `refreshLibraryStatus` calls should handle it; if they don't, the
  key change broke the cache identity — re-check).
- The header no longer hides/shows on scroll (the ref logic is wrong).
- The `tsc` error count changes (you touched something out of scope).

## Maintenance notes

- Reviewer: confirm the book page's `inLibrary` value still updates purely from
  the optimistic `refreshLibraryStatus(value, false)` calls — no revalidation is
  needed because membership only changes from this page's own button.
- If a future feature lets library membership change elsewhere while this page is
  open (e.g. multi-tab sync), reintroduce a *targeted* revalidation (e.g. on
  focus) rather than a fixed interval.
