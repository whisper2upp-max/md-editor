import type { CommentKind } from '../comments/node-comment'
import { commentIcon } from '../comments/node-comment'

const SVG = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
const ICON_EDIT = SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>')
const ICON_REPLY = SVG('<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>')
const ICON_TRASH = SVG('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>')
const ICON_UNCOMMENT = SVG('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><line x1="3.5" y1="3" x2="20.5" y2="21"/>')

function navText(value: string): string {
  const t = value.trim()
  if (!t) return '(空注释)'
  return t.length > 160 ? `${t.slice(0, 160)}…` : t
}

export interface CommentNavItem {
  kind: CommentKind
  value: string
  key: number
}

export interface CommentNavCallbacks {
  onJump: (key: number) => void
  onEdit: (key: number) => void
  onReply: (key: number) => void
  onDelete: (key: number) => void
  onUncomment: (key: number) => void
  onEditSubmit: (key: number, newValue: string) => void
  onEditCancel: (key: number) => void
}

const GROUP_META: Record<CommentKind, { label: string }> = {
  html: { label: '显性注释 <!-- -->' },
  tmpl: { label: '隐形注释 <%-- --%>' },
}

export class CommentsNavPanel {
  private el: HTMLElement
  private cb: CommentNavCallbacks
  private editingKey: number | null = null

  constructor(el: HTMLElement, cb: CommentNavCallbacks) {
    this.el = el
    this.cb = cb
  }

  setEditing(key: number | null): void {
    this.editingKey = key
  }

  /** Scroll to the nav item for `key` and briefly highlight it. */
  locate(key: number): void {
    const el = this.el.querySelector(`.cnav-item[data-key="${key}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    el.classList.remove('cnav-item--flash')
    // force reflow so the animation restarts on repeated clicks
    void el.offsetWidth
    el.classList.add('cnav-item--flash')
    window.setTimeout(() => el.classList.remove('cnav-item--flash'), 1700)
  }

  get activeEditKey(): number | null {
    return this.editingKey
  }

  render(items: CommentNavItem[]): void {
    if (items.length === 0) {
      this.el.innerHTML = `<div class="panel-empty">没有注释</div>`
      return
    }
    const groups: Record<CommentKind, CommentNavItem[]> = { html: [], tmpl: [] }
    for (const it of items) groups[it.kind].push(it)

    const frag = document.createDocumentFragment()
    ;(['html', 'tmpl'] as CommentKind[]).forEach((kind) => {
      const list = groups[kind]
      if (list.length === 0) return
      const meta = GROUP_META[kind]
      const section = document.createElement('div')
      section.className = `cnav-group cnav-group--${kind}`

      const header = document.createElement('div')
      header.className = 'cnav-header'
      header.innerHTML = `<span class="cnav-dot"></span><span class="cnav-title">${meta.label}</span><span class="cnav-count">${list.length}</span>`
      section.appendChild(header)

      for (const it of list) {
        const row = document.createElement('div')
        row.className = `cnav-item${this.editingKey === it.key ? ' cnav-item--editing' : ''}`
        row.dataset.key = String(it.key)

        if (this.editingKey === it.key) {
          const header = document.createElement('div')
          header.className = 'cnav-edit-header'
          const icon = document.createElement('span')
          icon.className = 'cnav-item-icon'
          icon.textContent = commentIcon(it.kind)
          header.appendChild(icon)

          const actions = document.createElement('span')
          actions.className = 'cnav-item-actions'
          const ok = document.createElement('button')
          ok.className = 'cnav-act cnav-act--ok'
          ok.textContent = '✓'
          ok.title = '确认'
          actions.appendChild(ok)
          const cancel = document.createElement('button')
          cancel.className = 'cnav-act cnav-act--cancel'
          cancel.textContent = '✕'
          cancel.title = '取消'
          actions.appendChild(cancel)
          header.appendChild(actions)
          row.appendChild(header)

          const input = document.createElement('textarea')
          input.className = 'cnav-edit-input'
          input.rows = 5
          input.value = it.value
          input.placeholder = '输入注释内容...'
          row.appendChild(input)

          ok.addEventListener('click', (e) => { e.stopPropagation(); this.cb.onEditSubmit(it.key, input.value) })
          cancel.addEventListener('click', (e) => { e.stopPropagation(); this.cb.onEditCancel(it.key) })
          input.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.cb.onEditSubmit(it.key, input.value) }
            if (e.key === 'Escape') { e.preventDefault(); this.cb.onEditCancel(it.key) }
          })

          queueFocus(input)
        } else {
          const body = document.createElement('span')
          body.className = 'cnav-item-body'
          body.textContent = navText(it.value)
          body.title = it.value.trim()
          body.addEventListener('click', () => this.cb.onJump(it.key))
          row.appendChild(body)

          const actions = document.createElement('span')
          actions.className = 'cnav-item-actions'
          const btns = [
            { cls: 'cnav-act--edit',   svg: ICON_EDIT,   title: '编辑',   fn: () => this.cb.onEdit(it.key) },
            { cls: 'cnav-act--reply',  svg: ICON_REPLY,  title: '回复',   fn: () => this.cb.onReply(it.key) },
            { cls: 'cnav-act--del',    svg: ICON_TRASH,  title: '删除',   fn: () => this.cb.onDelete(it.key) },
            { cls: 'cnav-act--uncom',  svg: ICON_UNCOMMENT, title: '取消注释', fn: () => this.cb.onUncomment(it.key) },
          ]
          for (const b of btns) {
            const btn = document.createElement('button')
            btn.className = `cnav-act ${b.cls}`
            btn.innerHTML = b.svg
            btn.title = b.title
            btn.setAttribute('aria-label', b.title)
            btn.addEventListener('click', (e) => { e.stopPropagation(); b.fn() })
            actions.appendChild(btn)
          }
          row.appendChild(actions)
        }
        section.appendChild(row)
      }
      frag.appendChild(section)
    })

    this.el.innerHTML = ''
    this.el.appendChild(frag)
  }
}

function queueFocus(el: HTMLTextAreaElement): void {
  requestAnimationFrame(() => { el.focus(); el.select() })
}
