export interface MenuItem {
  label?: string
  shortcut?: string
  onClick?: () => void
  submenu?: MenuItem[]
  sep?: boolean
  disabled?: boolean
}

let current: HTMLElement | null = null
let cleanup: (() => void) | null = null

export function closeMenu(): void {
  if (current) current.remove()
  current = null
  if (cleanup) cleanup()
  cleanup = null
}

function renderList(items: MenuItem[], onLeaf: () => void): HTMLElement {
  const list = document.createElement('div')
  for (const item of items) {
    if (item.sep) {
      const s = document.createElement('div')
      s.className = 'context-sep'
      list.appendChild(s)
      continue
    }
    const row = document.createElement('div')
    row.className = 'context-item'
    if (item.disabled) row.classList.add('disabled')

    const label = document.createElement('span')
    label.textContent = item.label ?? ''
    row.appendChild(label)

    if (item.submenu && item.submenu.length) {
      row.classList.add('has-sub')
      const arrow = document.createElement('span')
      arrow.className = 'ci-arrow'
      arrow.textContent = '▶'
      row.appendChild(arrow)
      const sub = renderList(item.submenu, onLeaf)
      sub.className = 'context-submenu'
      row.appendChild(sub)
    } else {
      if (item.shortcut) {
        const sc = document.createElement('span')
        sc.className = 'ci-shortcut'
        sc.textContent = item.shortcut
        row.appendChild(sc)
      }
      if (!item.disabled && item.onClick) {
        row.addEventListener('click', (e) => {
          e.stopPropagation()
          onLeaf()
          item.onClick!()
        })
      }
    }
    list.appendChild(row)
  }
  return list
}

export function showMenu(x: number, y: number, items: MenuItem[]): void {
  closeMenu()
  const menu = renderList(items, closeMenu)
  menu.className = 'context-menu'
  menu.style.visibility = 'hidden'
  document.body.appendChild(menu)

  const rect = menu.getBoundingClientRect()
  const px = Math.min(x, window.innerWidth - rect.width - 8)
  const py = Math.min(y, window.innerHeight - rect.height - 8)
  menu.style.left = `${Math.max(4, px)}px`
  menu.style.top = `${Math.max(4, py)}px`
  menu.style.visibility = 'visible'
  current = menu

  const onDoc = (e: Event) => {
    if (current && !current.contains(e.target as Node)) closeMenu()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMenu()
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', closeMenu)
  }, 0)
  cleanup = () => {
    document.removeEventListener('mousedown', onDoc, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('blur', closeMenu)
  }
}
