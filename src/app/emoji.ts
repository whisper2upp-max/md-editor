interface EmojiGroup {
  name: string
  items: string[]
}

const GROUPS: EmojiGroup[] = [
  {
    name: '表情',
    items: ['😀','😄','😁','😆','😅','😂','🙂','😊','😍','😘','😎','🤔','😐','😴','😢','😭','😡','👍','👎','👏','🙏','💪','🎉','🔥','✨','⭐','❤️','💔','✅','❌','⚠️','❓','❗','💡','📌','📎','🔖','📝','🚀','🎯'],
  },
  {
    name: '箭头',
    items: ['→','←','↑','↓','↔','↕','⇒','⇐','⇑','⇓','⇔','➡','⬅','⬆','⬇','↗','↘','↙','↖','⤴','⤵','➤','▶','◀','▲','▼'],
  },
  {
    name: '数学',
    items: ['±','×','÷','√','∞','≈','≠','≤','≥','∑','∏','∫','∂','∇','∈','∉','⊂','⊃','∪','∩','∀','∃','°','µ','π','Δ','Ω','α','β','γ','θ','λ'],
  },
  {
    name: '符号',
    items: ['•','◦','‣','·','…','—','–','«','»','“','”','‘','’','§','¶','©','®','™','€','£','¥','$','¢','†','‡','№','℃','℉','✓','✗','★','☆','♥','♦','♣','♠'],
  },
]

let el: HTMLElement | null = null
let cleanup: (() => void) | null = null

export function closeEmoji(): void {
  if (el) el.remove()
  el = null
  if (cleanup) cleanup()
  cleanup = null
}

export function showEmojiPicker(x: number, y: number, onPick: (s: string) => void): void {
  closeEmoji()
  const picker = document.createElement('div')
  picker.className = 'emoji-picker'

  const tabs = document.createElement('div')
  tabs.className = 'emoji-tabs'
  const grid = document.createElement('div')
  grid.className = 'emoji-grid'

  const renderGrid = (group: EmojiGroup) => {
    grid.innerHTML = ''
    for (const item of group.items) {
      const b = document.createElement('button')
      b.className = 'emoji-cell'
      b.textContent = item
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        onPick(item)
        closeEmoji()
      })
      grid.appendChild(b)
    }
  }

  GROUPS.forEach((group, i) => {
    const tab = document.createElement('button')
    tab.className = 'emoji-tab' + (i === 0 ? ' active' : '')
    tab.textContent = group.name
    tab.addEventListener('click', (e) => {
      e.stopPropagation()
      tabs.querySelectorAll('.emoji-tab').forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')
      renderGrid(group)
    })
    tabs.appendChild(tab)
  })
  renderGrid(GROUPS[0])

  picker.appendChild(tabs)
  picker.appendChild(grid)
  picker.style.visibility = 'hidden'
  document.body.appendChild(picker)

  const rect = picker.getBoundingClientRect()
  picker.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 8))}px`
  picker.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 8))}px`
  picker.style.visibility = 'visible'
  el = picker

  const onDoc = (e: Event) => {
    if (el && !el.contains(e.target as Node)) closeEmoji()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeEmoji()
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey, true)
  }, 0)
  cleanup = () => {
    document.removeEventListener('mousedown', onDoc, true)
    document.removeEventListener('keydown', onKey, true)
  }
}
