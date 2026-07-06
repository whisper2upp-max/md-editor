export interface ModalHandle {
  overlay: HTMLElement
  body: HTMLElement
  close: () => void
}

export function openModal(title: string, opts: { width?: number } = {}): ModalHandle {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  const box = document.createElement('div')
  box.className = 'modal-box modal-box--panel'
  if (opts.width) box.style.width = `${opts.width}px`

  const header = document.createElement('div')
  header.className = 'modal-header'
  const h = document.createElement('div')
  h.className = 'modal-title'
  h.textContent = title
  const x = document.createElement('button')
  x.className = 'modal-x'
  x.textContent = '✕'
  header.appendChild(h)
  header.appendChild(x)

  const body = document.createElement('div')
  body.className = 'modal-body'

  box.appendChild(header)
  box.appendChild(body)
  overlay.appendChild(box)
  document.body.appendChild(overlay)

  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKey, true)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  x.addEventListener('click', close)
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', onKey, true)

  return { overlay, body, close }
}
