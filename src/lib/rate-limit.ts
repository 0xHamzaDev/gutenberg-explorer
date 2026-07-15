import 'server-only'
import prisma from '@/lib/db'
import { decideRateLimit } from '@/lib/rate-limit-window'

// Per-user fixed-window limiter backed by Postgres (works across serverless
// instances). Fails OPEN on infra errors so a DB hiccup never breaks the
// feature — it just temporarily stops enforcing the cap.
export async function checkAiRateLimit(
	userId: string
): Promise<{ allowed: boolean; remaining: number }> {
	const now = new Date()
	try {
		return await prisma.$transaction(async tx => {
			const row = await tx.aiRateLimit.findUnique({ where: { userId } })
			const decision = decideRateLimit(row, now)
			if (decision.reset) {
				await tx.aiRateLimit.upsert({
					where: { userId },
					create: { userId, windowStart: now, count: 1 },
					update: { windowStart: now, count: 1 }
				})
			} else if (decision.allowed) {
				await tx.aiRateLimit.update({
					where: { userId },
					data: { count: { increment: 1 } }
				})
			}
			return { allowed: decision.allowed, remaining: decision.remaining }
		})
	} catch (error) {
		console.error('checkAiRateLimit error (failing open):', error)
		return { allowed: true, remaining: AI_RATE_MAX_FALLBACK }
	}
}

const AI_RATE_MAX_FALLBACK = 40
