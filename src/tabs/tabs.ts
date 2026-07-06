export type EditorMode = 'wysiwyg' | 'code'

export interface Doc {
  id: string
  name: string
  fileHandle: FileSystemFileHandle | null
  parentDir: FileSystemDirectoryHandle | null
  path: string | null
  content: string
  savedContent: string
  mode: EditorMode
}

let counter = 0
export function newId(): string {
  counter += 1
  return `doc-${counter}-${Date.now()}`
}

export function createDoc(partial: Partial<Doc> & { name: string; content: string }): Doc {
  return {
    id: newId(),
    name: partial.name,
    fileHandle: partial.fileHandle ?? null,
    parentDir: partial.parentDir ?? null,
    path: partial.path ?? null,
    content: partial.content,
    savedContent: partial.savedContent ?? partial.content,
    mode: partial.mode ?? 'wysiwyg',
  }
}

export function isDirty(doc: Doc): boolean {
  return doc.content !== doc.savedContent
}

export interface TabBarCallbacks {
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: () => void
}

export class TabBar {
  private el: HTMLElement
  private cb: TabBarCallbacks

  constructor(el: HTMLElement, cb: TabBarCallbacks) {
    this.el = el
    this.cb = cb
  }

  render(docs: Doc[], activeId: string | null): void {
    this.el.innerHTML = ''
    for (const doc of docs) {
      const tab = document.createElement('div')
      tab.className = 'tab' + (doc.id === activeId ? ' active' : '')
      tab.title = doc.path ?? doc.name

      const label = document.createElement('span')
      label.className = 'tab-label'
      label.textContent = doc.name
      tab.appendChild(label)

      if (isDirty(doc)) {
        const dot = document.createElement('span')
        dot.className = 'tab-dirty'
        dot.textContent = '●'
        tab.appendChild(dot)
      }

      const close = document.createElement('span')
      close.className = 'tab-close'
      close.textContent = '×'
      close.addEventListener('click', (e) => {
        e.stopPropagation()
        this.cb.onClose(doc.id)
      })
      tab.appendChild(close)

      tab.addEventListener('click', () => this.cb.onSelect(doc.id))
      this.el.appendChild(tab)
    }

    const add = document.createElement('button')
    add.className = 'tab-add'
    add.textContent = '＋'
    add.title = '新建标签页'
    add.addEventListener('click', () => this.cb.onAdd())
    this.el.appendChild(add)
  }
}
