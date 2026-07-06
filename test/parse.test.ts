import { describe, it, expect } from 'vitest'
import { extractComments } from '../src/comments/parse'

describe('extractComments', () => {
  it('finds an inline html comment', () => {
    const r = extractComments('文本 <!-- hi --> 结尾')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'html', value: ' hi ', line: 0 })
  })

  it('finds a template comment', () => {
    const r = extractComments('a <%-- todo --%> b')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'tmpl', value: ' todo ' })
  })

  it('finds both kinds in document order', () => {
    const r = extractComments('<%-- first --%> mid <!-- second -->')
    expect(r.map((c) => c.kind)).toEqual(['tmpl', 'html'])
  })

  it('handles empty comment', () => {
    const r = extractComments('<!---->')
    expect(r).toHaveLength(1)
    expect(r[0].value).toBe('')
  })

  it('handles multi-line comment and reports start line', () => {
    const text = 'line0\n<!-- a\nb -->\nline3'
    const r = extractComments(text)
    expect(r).toHaveLength(1)
    expect(r[0].line).toBe(1)
    expect(r[0].value).toBe(' a\nb ')
  })

  it('ignores comments inside fenced code blocks', () => {
    const text = '```\n<!-- not a comment -->\n```\n<!-- real -->'
    const r = extractComments(text)
    expect(r).toHaveLength(1)
    expect(r[0].value).toBe(' real ')
  })

  it('ignores comments inside inline code', () => {
    const text = '`<!-- code -->` but <!-- yes -->'
    const r = extractComments(text)
    expect(r).toHaveLength(1)
    expect(r[0].value).toBe(' yes ')
  })

  it('computes line numbers across the document', () => {
    const text = 'a\nb\n<%-- x --%>'
    const r = extractComments(text)
    expect(r[0].line).toBe(2)
  })
})
