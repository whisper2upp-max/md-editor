export type CommentKind = 'html' | 'tmpl'

export interface ParsedComment {
  kind: CommentKind
  value: string
  line: number
  index: number
}

interface Span {
  start: number
  end: number
}

function fencedCodeSpans(text: string): Span[] {
  const spans: Span[] = []
  const re = /^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    spans.push({ start: m.index, end: m.index + m[0].length })
  }
  return spans
}

function inlineCodeSpans(text: string): Span[] {
  const spans: Span[] = []
  const re = /(`+)(?:[^`]|(?!\1)`)*?\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    spans.push({ start: m.index, end: m.index + m[0].length })
  }
  return spans
}

function inSpans(pos: number, spans: Span[]): boolean {
  return spans.some((s) => pos >= s.start && pos < s.end)
}

function lineOf(text: string, pos: number): number {
  let line = 0
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') line++
  }
  return line
}

/**
 * Extract all comments (both `<!-- -->` and `<%-- --%>`) from markdown text,
 * ignoring those inside fenced or inline code. Returns them in document order
 * with 0-based line numbers.
 */
export function extractComments(text: string): ParsedComment[] {
  const skip = [...fencedCodeSpans(text), ...inlineCodeSpans(text)]
  const results: ParsedComment[] = []

  const patterns: { kind: CommentKind; re: RegExp }[] = [
    { kind: 'html', re: /<!--([\s\S]*?)-->/g },
    { kind: 'tmpl', re: /<%--([\s\S]*?)--%>/g },
  ]

  for (const { kind, re } of patterns) {
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, 'g')
    while ((m = r.exec(text))) {
      if (inSpans(m.index, skip)) continue
      results.push({ kind, value: m[1], line: lineOf(text, m.index), index: m.index })
    }
  }

  results.sort((a, b) => a.index - b.index)
  return results
}

export interface ParsedHeading {
  level: number
  text: string
  line: number
}

/** Extract ATX headings (`# ...`) with 1-based line numbers, skipping fenced code. */
export function extractHeadings(text: string): ParsedHeading[] {
  const fences = fencedCodeSpans(text)
  const lines = text.split('\n')
  const out: ParsedHeading[] = []
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (m && !inSpans(offset, fences)) {
      out.push({ level: m[1].length, text: m[2], line: i + 1 })
    }
    offset += line.length + 1
  }
  return out
}
