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
