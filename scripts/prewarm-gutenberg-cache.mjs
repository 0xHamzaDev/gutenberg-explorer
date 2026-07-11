// One-off: populate the GutenbergBook cache and backfill UserLibrary metadata.
// Run: node --env-file=.env scripts/prewarm-gutenberg-cache.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function fixUrl(u) {
	if (!u) return ''
	if (u.startsWith('http://') || u.startsWith('https://')) return u
	return `https:${u.startsWith('//') ? u : `//${u}`}`
}

function normalize(raw) {
	return {
		id: raw.id,
		title: raw.title,
		author: raw.authors?.[0]?.name || 'Unknown Author',
		coverUrl: fixUrl(raw.formats?.['image/jpeg']),
		subjects: raw.subjects || [],
		languages: raw.languages || [],
		downloadCount: raw.download_count || 0
	}
}

async function getJson(url, tries = 3) {
	let lastErr
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			return await res.json()
		} catch (e) {
			lastErr = e
			await new Promise(r => setTimeout(r, 1000 * (i + 1)))
		}
	}
	throw lastErr
}

async function upsert(b) {
	await prisma.gutenbergBook.upsert({
		where: { id: b.id },
		create: b,
		update: { ...b, cachedAt: new Date() }
	})
}

async function main() {
	// 1) Prewarm popular books (default Gutendex sort = most downloaded).
	let warmed = 0
	for (let page = 1; page <= 3; page++) {
		try {
			const data = await getJson(
				`https://gutendex.com/books/?page=${page}`
			)
			for (const raw of data.results || []) {
				await upsert(normalize(raw))
				warmed++
			}
			console.log(`prewarm page ${page}: +${data.results?.length || 0}`)
		} catch (e) {
			console.log(`prewarm page ${page} failed:`, e.message)
		}
	}
	console.log(`Prewarmed ${warmed} popular books into cache.`)

	// 2) Backfill denormalized metadata for existing library rows.
	const rows = await prisma.userLibrary.findMany()
	let filled = 0
	for (const row of rows) {
		if ((row.subjects?.length || 0) > 0) continue
		const id = parseInt(row.bookId, 10)
		if (Number.isNaN(id)) continue
		try {
			const raw = await getJson(`https://gutendex.com/books/${id}`)
			const b = normalize(raw)
			await upsert(b)
			await prisma.userLibrary.update({
				where: { id: row.id },
				data: { subjects: b.subjects, languages: b.languages }
			})
			filled++
			console.log(
				`backfilled: ${b.title.slice(0, 40)} (${b.subjects.length} subjects)`
			)
		} catch (e) {
			console.log(`backfill ${id} failed:`, e.message)
		}
	}
	console.log(`Backfilled ${filled}/${rows.length} library rows.`)

	const total = await prisma.gutenbergBook.count()
	console.log(`GutenbergBook cache now holds ${total} books.`)
}

main()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(() => prisma.$disconnect())
