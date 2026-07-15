import { describe, it, expect } from 'vitest'
import { decideRateLimit, AI_RATE_MAX } from './rate-limit-window'

const now = new Date('2026-07-15T12:00:00Z')

describe('decideRateLimit', () => {
	it('starts a fresh window when no row exists', () => {
		const d = decideRateLimit(null, now)
		expect(d).toEqual({ allowed: true, reset: true, remaining: AI_RATE_MAX - 1 })
	})
	it('resets when the window has fully elapsed', () => {
		const old = { windowStart: new Date(now.getTime() - 60 * 60 * 1000), count: AI_RATE_MAX }
		const d = decideRateLimit(old, now)
		expect(d.reset).toBe(true)
		expect(d.allowed).toBe(true)
	})
	it('allows and decrements remaining within the window under the cap', () => {
		const row = { windowStart: new Date(now.getTime() - 1000), count: 5 }
		const d = decideRateLimit(row, now)
		expect(d).toEqual({ allowed: true, reset: false, remaining: AI_RATE_MAX - 6 })
	})
	it('blocks when the count has reached the cap within the window', () => {
		const row = { windowStart: new Date(now.getTime() - 1000), count: AI_RATE_MAX }
		const d = decideRateLimit(row, now)
		expect(d).toEqual({ allowed: false, reset: false, remaining: 0 })
	})
})
