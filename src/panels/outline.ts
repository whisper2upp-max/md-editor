export interface OutlineItem {
  level: number
  text: string
  key: number
}

export class OutlinePanel {
  private el: HTMLElement
  private onJump: (key: number) => void

  constructor(el: HTMLElement, onJump: (key: number) => void) {
    this.el = el
    this.onJump = onJump
  }

  render(items: OutlineItem[]): void {
    if (items.length === 0) {
      this.el.innerHTML = `<div class="panel-empty">没有标题</div>`
      return
    }
    const minLevel = Math.min(...items.map((i) => i.level))
    const ul = document.createElement('ul')
    ul.className = 'outline'
    for (const item of items) {
      const li = document.createElement('li')
      li.className = 'outline-item'
      li.style.paddingLeft = `${8 + (item.level - minLevel) * 14}px`
      li.textContent = item.text || '(空标题)'
      li.title = item.text
      li.addEventListener('click', () => this.onJump(item.key))
      ul.appendChild(li)
    }
    this.el.innerHTML = ''
    this.el.appendChild(ul)
  }
}
