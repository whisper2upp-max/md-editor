import type { EditorView as CMView } from '@codemirror/view'
import type { EditorView as PMView } from '@milkdown/kit/prose/view'
import { TextSelection } from '@milkdown/kit/prose/state'

export interface SearchController {
  update(query: string, caseSensitive: boolean): number
  currentIndex(): number
  count(): number
  next(): void
  prev(): void
  replaceCurrent(replacement: string): void
  replaceAll(query: string, replacement: string, caseSensitive: boolean): number
  clear(): void
}

interface Match {
  from: number
  to: number
}

function findMatches(text: string, query: string, caseSensitive: boolean): Match[] {
  if (!query) return []
  const matches: Match[] = []
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  let i = 0
  while (i <= hay.length) {
    const idx = hay.indexOf(needle, i)
    if (idx === -1) break
    matches.push({ from: idx, to: idx + needle.length })
    i = idx + Math.max(1, needle.length)
  }
  return matches
}

export class CodeSearchController implements SearchController {
  private matches: Match[] = []
  private idx = -1
  constructor(private view: CMView) {}

  update(query: string, caseSensitive: boolean): number {
    this.matches = findMatches(this.view.state.doc.toString(), query, caseSensitive)
    this.idx = this.matches.length ? 0 : -1
    this.reveal()
    return this.matches.length
  }
  currentIndex() { return this.idx }
  count() { return this.matches.length }
  next() { if (this.matches.length) { this.idx = (this.idx + 1) % this.matches.length; this.reveal() } }
  prev() { if (this.matches.length) { this.idx = (this.idx - 1 + this.matches.length) % this.matches.length; this.reveal() } }

  private reveal() {
    const m = this.matches[this.idx]
    if (!m) return
    const max = this.view.state.doc.length
    const from = Math.min(m.from, max)
    const to = Math.min(m.to, max)
    this.view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
    this.view.focus()
  }

  replaceCurrent(replacement: string): void {
    const m = this.matches[this.idx]
    if (!m) return
    this.view.dispatch({ changes: { from: m.from, to: m.to, insert: replacement } })
  }

  replaceAll(query: string, replacement: string, caseSensitive: boolean): number {
    const ms = findMatches(this.view.state.doc.toString(), query, caseSensitive)
    if (!ms.length) return 0
    this.view.dispatch({ changes: ms.map((m) => ({ from: m.from, to: m.to, insert: replacement })) })
    this.matches = []
    this.idx = -1
    return ms.length
  }

  clear() { this.matches = []; this.idx = -1 }
}

interface Seg { strStart: number; pmStart: number; len: number }

export class ProseSearchController implements SearchController {
  private matches: Match[] = []
  private idx = -1
  constructor(private getView: () => PMView) {}

  private buildText(): { text: string; segs: Seg[] } {
    const view = this.getView()
    let text = ''
    const segs: Seg[] = []
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        segs.push({ strStart: text.length, pmStart: pos, len: node.text.length })
        text += node.text
      } else if (node.isBlock && text.length && !text.endsWith('\n')) {
        text += '\n'
      }
      return true
    })
    return { text, segs }
  }

  private mapOffset(offset: number, segs: Seg[]): number | null {
    for (const s of segs) {
      if (offset >= s.strStart && offset <= s.strStart + s.len) {
        return s.pmStart + (offset - s.strStart)
      }
    }
    return null
  }

  update(query: string, caseSensitive: boolean): number {
    const { text, segs } = this.buildText()
    // Only keep matches whose start and end both map back to a PM position;
    // matches spanning synthetic block separators can't be revealed/replaced,
    // so they must not be counted either.
    this.matches = findMatches(text, query, caseSensitive).filter(
      (m) => this.mapOffset(m.from, segs) != null && this.mapOffset(m.to, segs) != null
    )
    this.idx = this.matches.length ? 0 : -1
    this.reveal()
    return this.matches.length
  }
  currentIndex() { return this.idx }
  count() { return this.matches.length }
  next() { if (this.matches.length) { this.idx = (this.idx + 1) % this.matches.length; this.reveal() } }
  prev() { if (this.matches.length) { this.idx = (this.idx - 1 + this.matches.length) % this.matches.length; this.reveal() } }

  private reveal() {
    const m = this.matches[this.idx]
    if (!m) return
    const view = this.getView()
    const { segs } = this.buildText()
    const from = this.mapOffset(m.from, segs)
    const to = this.mapOffset(m.to, segs)
    if (from == null || to == null) return
    try {
      const sel = TextSelection.create(view.state.doc, from, to)
      view.dispatch(view.state.tr.setSelection(sel).scrollIntoView())
      view.focus()
    } catch {
      /* position out of range after edits */
    }
  }

  replaceCurrent(replacement: string): void {
    const m = this.matches[this.idx]
    if (!m) return
    const view = this.getView()
    const { segs } = this.buildText()
    const from = this.mapOffset(m.from, segs)
    const to = this.mapOffset(m.to, segs)
    if (from == null || to == null) return
    view.dispatch(view.state.tr.insertText(replacement, from, to))
  }

  replaceAll(query: string, replacement: string, caseSensitive: boolean): number {
    const view = this.getView()
    const { text, segs } = this.buildText()
    const ms = findMatches(text, query, caseSensitive)
    if (!ms.length) return 0
    let tr = view.state.tr
    let replaced = 0
    for (let i = ms.length - 1; i >= 0; i--) {
      const from = this.mapOffset(ms[i].from, segs)
      const to = this.mapOffset(ms[i].to, segs)
      if (from != null && to != null) {
        tr = tr.insertText(replacement, from, to)
        replaced++
      }
    }
    if (replaced > 0) view.dispatch(tr)
    this.matches = []
    this.idx = -1
    return replaced
  }

  clear() { this.matches = []; this.idx = -1 }
}


export interface FindReplaceOptions {
  getController: () => SearchController
  onClose?: () => void
}

export class FindReplace {
  private root: HTMLElement
  private el: HTMLElement | null = null
  private findInput!: HTMLInputElement
  private replaceInput!: HTMLInputElement
  private countLabel!: HTMLElement
  private caseSensitive = false
  private opts: FindReplaceOptions

  constructor(root: HTMLElement, opts: FindReplaceOptions) {
    this.root = root
    this.opts = opts
  }

  isOpen(): boolean {
    return this.el !== null
  }

  open(selected?: string): void {
    if (this.el) {
      if (selected) this.findInput.value = selected
      this.findInput.focus()
      this.findInput.select()
      this.runFind()
      return
    }
    const box = document.createElement('div')
    box.className = 'find-replace'
    box.innerHTML = `
      <div class="fr-row">
        <input class="fr-input fr-find" placeholder="查找" />
        <button class="fr-btn fr-case" title="区分大小写">Aa</button>
        <span class="fr-count">0/0</span>
        <button class="fr-btn fr-prev" title="上一个">▲</button>
        <button class="fr-btn fr-next" title="下一个">▼</button>
        <button class="fr-btn fr-close" title="关闭 (Esc)">✕</button>
      </div>
      <div class="fr-row">
        <input class="fr-input fr-replace" placeholder="替换为" />
        <button class="fr-btn fr-rep" title="替换当前">替换</button>
        <button class="fr-btn fr-repall" title="全部替换">全部替换</button>
      </div>`
    this.root.appendChild(box)
    this.el = box
    this.findInput = box.querySelector('.fr-find')!
    this.replaceInput = box.querySelector('.fr-replace')!
    this.countLabel = box.querySelector('.fr-count')!

    if (selected) this.findInput.value = selected

    const caseBtn = box.querySelector('.fr-case') as HTMLButtonElement
    caseBtn.addEventListener('click', () => {
      this.caseSensitive = !this.caseSensitive
      caseBtn.classList.toggle('on', this.caseSensitive)
      this.runFind()
    })
    box.querySelector('.fr-prev')!.addEventListener('click', () => { this.opts.getController().prev(); this.updateCount() })
    box.querySelector('.fr-next')!.addEventListener('click', () => { this.opts.getController().next(); this.updateCount() })
    box.querySelector('.fr-close')!.addEventListener('click', () => this.close())
    box.querySelector('.fr-rep')!.addEventListener('click', () => this.replaceOne())
    box.querySelector('.fr-repall')!.addEventListener('click', () => this.replaceAll())

    let t: number | null = null
    this.findInput.addEventListener('input', () => {
      if (t) clearTimeout(t)
      t = window.setTimeout(() => this.runFind(), 150)
    })
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) this.opts.getController().prev(); else this.opts.getController().next(); this.updateCount() }
      if (e.key === 'Escape') this.close()
    })
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.replaceOne() }
      if (e.key === 'Escape') this.close()
    })

    this.findInput.focus()
    this.findInput.select()
    if (this.findInput.value) this.runFind()
  }

  private runFind(): void {
    const q = this.findInput.value
    if (!q) { this.opts.getController().clear(); this.countLabel.textContent = '0/0'; return }
    this.opts.getController().update(q, this.caseSensitive)
    this.updateCount()
  }

  private updateCount(): void {
    const c = this.opts.getController()
    const total = c.count()
    this.countLabel.textContent = total ? `${c.currentIndex() + 1}/${total}` : '0/0'
  }

  private replaceOne(): void {
    const c = this.opts.getController()
    c.replaceCurrent(this.replaceInput.value)
    setTimeout(() => this.runFind(), 30)
  }

  private replaceAll(): void {
    const c = this.opts.getController()
    const n = c.replaceAll(this.findInput.value, this.replaceInput.value, this.caseSensitive)
    this.countLabel.textContent = `已替换 ${n}`
  }

  close(): void {
    this.opts.getController().clear()
    if (this.el) this.el.remove()
    this.el = null
    this.opts.onClose?.()
  }
}
