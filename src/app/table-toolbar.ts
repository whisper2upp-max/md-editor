import type { TableOp } from '../editor/editor'

const BUTTONS: { op: TableOp; label: string; title: string }[] = [
  { op: 'rowBefore', label: '↑行', title: '上方插入行' },
  { op: 'rowAfter', label: '↓行', title: '下方插入行' },
  { op: 'colBefore', label: '←列', title: '左侧插入列' },
  { op: 'colAfter', label: '→列', title: '右侧插入列' },
  { op: 'delRow', label: '✕行', title: '删除当前行' },
  { op: 'delCol', label: '✕列', title: '删除当前列' },
]

export class TableToolbar {
  readonly el: HTMLElement
  private onOp: (op: TableOp) => void

  constructor(onOp: (op: TableOp) => void) {
    this.onOp = onOp
    this.el = document.createElement('div')
    this.el.className = 'table-toolbar'
    this.el.hidden = true
    // Prevent the toolbar from stealing focus/selection from the editor
    this.el.addEventListener('mousedown', (e) => e.preventDefault())
    for (const b of BUTTONS) {
      const btn = document.createElement('button')
      btn.className = 'tt-btn' + (b.op.startsWith('del') ? ' tt-del' : '')
      btn.textContent = b.label
      btn.title = b.title
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.onOp(b.op)
      })
      this.el.appendChild(btn)
    }
    document.body.appendChild(this.el)
  }

  /** Show the toolbar positioned above (or below) the given table element. */
  showFor(table: HTMLElement): void {
    const rect = table.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return this.hide()
    this.el.hidden = false
    const h = this.el.getBoundingClientRect().height || 32
    const above = rect.top - h - 6
    let top = above > 46 ? above : rect.bottom + 6
    top = Math.max(46, Math.min(top, window.innerHeight - h - 8))
    this.el.style.left = `${Math.max(6, Math.min(rect.left, window.innerWidth - 240))}px`
    this.el.style.top = `${top}px`
  }

  isVisible(): boolean {
    return !this.el.hidden
  }

  hide(): void {
    this.el.hidden = true
  }

  destroy(): void {
    this.el.remove()
  }
}
