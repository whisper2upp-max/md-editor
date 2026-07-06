let container: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

export function toast(message: string, kind: 'info' | 'error' | 'success' = 'info', ms = 2600): void {
  const el = document.createElement('div')
  el.className = `toast toast--${kind}`
  el.textContent = message
  ensureContainer().appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast--show'))
  setTimeout(() => {
    el.classList.remove('toast--show')
    setTimeout(() => el.remove(), 300)
  }, ms)
}

export function confirmDialog(message: string): boolean {
  return window.confirm(message)
}

export function promptDialog(message: string, initial = ''): string | null {
  return window.prompt(message, initial)
}

export type SaveChoice = 'save' | 'discard' | 'cancel'

/** Three-button modal: save / don't save / cancel. */
export function saveConfirmDialog(message: string): Promise<SaveChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    const box = document.createElement('div')
    box.className = 'modal-box'
    box.innerHTML = `
      <div class="modal-msg">${escapeHtml(message)}</div>
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">取消</button>
        <button class="modal-btn modal-discard">不保存</button>
        <button class="modal-btn modal-save modal-primary">保存</button>
      </div>`
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    const done = (choice: SaveChoice) => {
      overlay.remove()
      document.removeEventListener('keydown', onKey, true)
      resolve(choice)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') done('cancel')
      if (e.key === 'Enter') done('save')
    }
    box.querySelector('.modal-cancel')!.addEventListener('click', () => done('cancel'))
    box.querySelector('.modal-discard')!.addEventListener('click', () => done('discard'))
    box.querySelector('.modal-save')!.addEventListener('click', () => done('save'))
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) done('cancel') })
    document.addEventListener('keydown', onKey, true)
    ;(box.querySelector('.modal-save') as HTMLButtonElement).focus()
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

