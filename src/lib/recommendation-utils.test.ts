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
