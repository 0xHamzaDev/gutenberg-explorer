export const AI_RATE_WINDOW_MS = 1000 * 60 * 60 // 1 hour
export const AI_RATE_MAX = 40 // requests per user per window

export interface RateWindowRow {
	windowStart: Date
	count: number
}

export interface RateDecision {
	allowed: boolean
	reset: boolean // true => start a fresh window at `now`
	remaining: number
}

// Pure fixed-window decision. No I/O.
export function decideRateLimit(
	row: RateWindowRow | null,
	now: Date,
	windowMs: number = AI_RATE_WINDOW_MS,
	max: number = AI_RATE_MAX
): RateDecision {
	if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
		return { allowed: true, reset: true, remaining: max - 1 }
	}
	if (row.count >= max) {
		return { allowed: false, reset: false, remaining: 0 }
	}
	return { allowed: true, reset: false, remaining: max - row.count - 1 }
}
