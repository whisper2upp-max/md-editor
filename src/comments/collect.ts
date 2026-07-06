import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import type { CommentKind } from './node-comment'

export interface CollectedComment {
  kind: CommentKind
  value: string
  pos: number
}

export interface CollectedHeading {
  level: number
  text: string
  pos: number
}

export function collectComments(view: EditorView): CollectedComment[] {
  const out: CollectedComment[] = []
  view.state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.name === 'comment') {
      out.push({
        kind: (node.attrs.kind as CommentKind) ?? 'html',
        value: (node.attrs.value as string) ?? '',
        pos,
      })
    }
    return true
  })
  return out
}

export function collectHeadings(view: EditorView): CollectedHeading[] {
  const out: CollectedHeading[] = []
  view.state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.name === 'heading') {
      out.push({
        level: (node.attrs.level as number) ?? 1,
        text: node.textContent,
        pos,
      })
    }
    return true
  })
  return out
}

export function scrollToPos(view: EditorView, pos: number): void {
  const dom = view.nodeDOM(pos) as HTMLElement | null
  const target =
    dom ?? (view.domAtPos(Math.min(pos + 1, view.state.doc.content.size)).node as HTMLElement | null)
  const el = target && target.nodeType === 1 ? (target as HTMLElement) : (target?.parentElement ?? null)
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('md-jump-flash')
    setTimeout(() => el.classList.remove('md-jump-flash'), 1200)
  }
}
