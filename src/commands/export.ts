import mermaid from 'mermaid'

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const EXPORT_CSS = `
body{font-family:-apple-system,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;line-height:1.7;color:#1f2328;max-width:820px;margin:40px auto;padding:0 20px}
h1,h2,h3,h4{line-height:1.3;margin-top:1.4em}
pre{background:#f6f8fa;padding:14px;border-radius:8px;overflow:auto}
code{background:#f6f8fa;padding:2px 5px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace}
pre code{background:none;padding:0}
blockquote{border-left:4px solid #d0d7de;margin:0;padding-left:16px;color:#57606a}
table{border-collapse:collapse}th,td{border:1px solid #c4d2c7;padding:6px 12px}
table th{background:#d3e6d8;font-weight:600}
table tr:nth-of-type(even) td{background:#eef3ec}
table tr:nth-of-type(odd) td{background:#e2ebe1}
img{max-width:100%}
.mermaid-rendered{text-align:center;margin:16px 0}
.md-comment{display:inline-block;padding:0 6px;border-radius:6px;font-size:.85em}
.md-comment--html{color:#b45309;background:#fef3c7;border:1px solid #f59e0b55}
.md-comment--tmpl{color:#7c3aed;background:#ede9fe;border:1px solid #7c3aed55}
`

let mermaidReady = false
function initMermaid(): void {
  if (!mermaidReady) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
    mermaidReady = true
  }
}

async function renderMermaid(container: HTMLElement): Promise<void> {
  const blocks = Array.from(container.querySelectorAll('pre[data-language="mermaid"]'))
  if (blocks.length === 0) return
  initMermaid()
  let i = 0
  for (const pre of blocks) {
    const code = pre.textContent ?? ''
    try {
      const { svg } = await mermaid.render(`mmd-export-${Date.now()}-${i++}`, code)
      const div = document.createElement('div')
      div.className = 'mermaid-rendered'
      div.innerHTML = svg
      pre.replaceWith(div)
    } catch {
      /* leave code block as-is on error */
    }
  }
}

const DARK_CSS = `
body{background:#0d1117;color:#e6edf3}
pre,code{background:#161b22 !important;color:#e6edf3}
blockquote{border-left-color:#30363d;color:#8b949e}
th,td{border-color:#3d4b57}
table th{background:#2b3a30 !important}
table tr:nth-of-type(even) td{background:#1a2230}
table tr:nth-of-type(odd) td{background:#212a3a}
a{color:#4c8bf5}
`

export interface ExportOptions {
  dark?: boolean
  nav?: { text: string; level: number }[]
}

export async function exportHTML(title: string, contentHTML: string, opts: ExportOptions = {}): Promise<void> {
  const container = document.createElement('div')
  container.innerHTML = contentHTML
  await renderMermaid(container)

  let navHtml = ''
  let layoutCss = ''
  if (opts.nav && opts.nav.length) {
    const min = Math.min(...opts.nav.map((n) => n.level))
    const items = opts.nav
      .map((n) => `<li style="margin-left:${(n.level - min) * 14}px">${escapeHtml(n.text)}</li>`)
      .join('')
    navHtml = `<nav class="export-nav"><div class="export-nav-title">目录</div><ul>${items}</ul></nav>`
    layoutCss = `
body{max-width:none;margin:0;display:flex}
.export-nav{width:240px;flex:0 0 auto;border-right:1px solid #d0d7de;padding:24px 16px;position:sticky;top:0;height:100vh;overflow:auto;font-size:14px}
.export-nav ul{list-style:none;padding:0;margin:8px 0}
.export-nav li{padding:3px 0;color:#57606a}
.export-nav-title{font-weight:600}
.export-main{flex:1 1 auto;padding:40px;max-width:820px}
`
  }

  const body = navHtml ? `${navHtml}<main class="export-main">${container.innerHTML}</main>` : container.innerHTML
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}${layoutCss}${opts.dark ? DARK_CSS : ''}</style></head>
<body>${body}</body></html>`
  download(`${title || 'document'}.html`, html, 'text/html;charset=utf-8')
}

export function exportPDF(): void {
  window.print()
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
