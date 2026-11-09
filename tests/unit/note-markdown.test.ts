import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteMarkdown } from '@/components/NoteMarkdown'

const html = (source: string) => renderToStaticMarkup(createElement(NoteMarkdown, { source }))

describe('NoteMarkdown', () => {
  it('does not render raw HTML', () => {
    expect(html('<script>alert(1)</script>')).not.toContain('<script')
  })
  it('strips javascript: links', () => {
    expect(html('[x](javascript:alert(1))')).not.toContain('javascript:')
  })
  it('renders markdown', () => {
    expect(html('**a**')).toContain('<strong>a</strong>')
    expect(html('```py\nprint(1)\n```')).toContain('<pre')
  })
  it('opens links safely in new tab', () => {
    const out = html('[x](https://a.uz)')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })
})
