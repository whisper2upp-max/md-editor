import { $remark, $nodeSchema } from '@milkdown/kit/utils'
import type { EditorView } from '@milkdown/kit/prose/view'

export type CommentKind = 'html' | 'tmpl'

const HTML_COMMENT_RE = /^<!--([\s\S]*)-->$/
const TMPL_COMMENT_GLOBAL = /<%--([\s\S]*?)--%>/g

const INLINE_PARENTS = new Set(['paragraph', 'heading', 'tableCell'])

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  [k: string]: unknown
}

export function rawComment(kind: CommentKind, value: string): string {
  return kind === 'tmpl' ? `<%--${value}--%>` : `<!--${value}-->`
}

export function commentLabel(value: string): string {
  const t = value.trim()
  if (!t) return '(空注释)'
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}

export function commentIcon(kind: CommentKind): string {
  return kind === 'tmpl' ? '📌' : '💬'
}

function splitTmpl(text: string): MdNode[] {
  const parts: MdNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(TMPL_COMMENT_GLOBAL.source, 'g')
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    parts.push({ type: 'comment', kind: 'tmpl', value: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

function transform(node: MdNode): void {
  if (!Array.isArray(node.children)) return
  const blockLevel = !INLINE_PARENTS.has(node.type)
  const out: MdNode[] = []
  for (const child of node.children) {
    if (child.type === 'html' && typeof child.value === 'string') {
      const m = HTML_COMMENT_RE.exec(child.value.trim())
      if (m) {
        const c: MdNode = { type: 'comment', kind: 'html', value: m[1] }
        out.push(blockLevel ? { type: 'paragraph', children: [c] } : c)
        continue
      }
    }
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('<%--')) {
      out.push(...splitTmpl(child.value))
      continue
    }
    transform(child)
    out.push(child)
  }
  node.children = out
}

export const remarkComment = $remark('remark-comment', () => () => (tree: unknown) => {
  transform(tree as MdNode)
})

export const commentNode = $nodeSchema('comment', () => ({
  atom: true,
  inline: true,
  group: 'inline',
  selectable: true,
  attrs: {
    kind: { default: 'html' as CommentKind },
    value: { default: '' },
  },
  toDOM: (node) => {
    const kind = node.attrs.kind as CommentKind
    const value = node.attrs.value as string
    return [
      'span',
      {
        'data-comment': kind,
        'data-value': value,
        class: `md-comment md-comment--${kind}`,
        title: rawComment(kind, value),
      },
      ['span', { class: 'md-comment-icon' }, commentIcon(kind)],
      ['span', { class: 'md-comment-text' }, commentLabel(value)],
    ]
  },
  parseDOM: [
    {
      tag: 'span[data-comment]',
      getAttrs: (dom) => {
        const el = dom as HTMLElement
        return { kind: (el.dataset.comment as CommentKind) || 'html', value: el.dataset.value || '' }
      },
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'comment',
    runner: (state, node, type) => {
      state.addNode(type, { kind: (node.kind as CommentKind) ?? 'html', value: (node.value as string) ?? '' })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'comment',
    runner: (state, node) => {
      state.addNode('html', undefined, rawComment(node.attrs.kind as CommentKind, node.attrs.value as string))
    },
  },
}))

export const commentPlugins = [remarkComment, commentNode].flat()

// --- DOM-based editing: find PM position from clicked DOM element ---

export function findCommentPos(view: EditorView, dom: HTMLElement): number | null {
  let found: number | null = null
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'comment') {
      const nd = view.nodeDOM(pos) as HTMLElement | null
      if (nd === dom || nd?.contains(dom) || dom.contains(nd)) {
        found = pos
        return false
      }
    }
    return true
  })
  return found
}
