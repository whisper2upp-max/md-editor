import { openModal } from './modal'
import { t, type Lang } from './i18n'

export interface Settings {
  autoSaveOnSwitch: boolean
  dropBehavior: 'open' | 'link'
  language: Lang
  imgPreferRelative: boolean
  imgAddDotSlash: boolean
  imgAutoEscapeUrl: boolean
  exportKeepNav: boolean
  exportUseTheme: boolean
}

const KEY = 'md-editor:settings'

export const APP_VERSION = '0.5.0'

export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  { version: '0.5.0', date: '2026-07-05', items: ['新增上菜单栏（文件/编辑/段落/格式/显示）', '查找替换 (Ctrl+F)', '表格浮动工具栏', '设置窗口与帮助', '中英文切换'] },
  { version: '0.4.0', date: '2026-07-05', items: ['注释导航：编辑/回复/删除/取消注释', '右键菜单', '修复粘贴为纯文本'] },
  { version: '0.3.0', date: '2026-07-05', items: ['显性/隐形注释', '深色主题对比度修复'] },
  { version: '0.1.0', date: '2026-07-05', items: ['首个版本：所见即所得编辑器 + 注释导航 + 文件树/大纲'] },
]

const DEFAULTS: Settings = {
  autoSaveOnSwitch: false,
  dropBehavior: 'open',
  language: 'zh',
  imgPreferRelative: true,
  imgAddDotSlash: false,
  imgAutoEscapeUrl: true,
  exportKeepNav: false,
  exportUseTheme: false,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

type TabKey = 'file' | 'general' | 'image' | 'export'

export function openSettingsDialog(
  settings: Settings,
  onChange: (s: Settings, changed: keyof Settings) => void
): void {
  const modal = openModal(t('settings.title'), { width: 520 })
  const container = document.createElement('div')
  container.className = 'settings'

  const tabs = document.createElement('div')
  tabs.className = 'settings-tabs'
  const content = document.createElement('div')
  content.className = 'settings-content'

  const tabDefs: { key: TabKey; label: string }[] = [
    { key: 'file', label: t('settings.tab.file') },
    { key: 'general', label: t('settings.tab.general') },
    { key: 'image', label: t('settings.tab.image') },
    { key: 'export', label: t('settings.tab.export') },
  ]

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    settings[k] = v
    saveSettings(settings)
    onChange(settings, k)
  }

  const checkbox = (label: string, key: keyof Settings): HTMLElement => {
    const row = document.createElement('label')
    row.className = 'settings-row'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = settings[key] as boolean
    cb.addEventListener('change', () => set(key, cb.checked as never))
    const span = document.createElement('span')
    span.textContent = label
    row.appendChild(cb)
    row.appendChild(span)
    return row
  }

  const renderTab = (key: TabKey) => {
    content.innerHTML = ''
    if (key === 'file') {
      content.appendChild(checkbox(t('settings.autoSaveOnSwitch'), 'autoSaveOnSwitch'))
      const row = document.createElement('div')
      row.className = 'settings-row settings-row--col'
      const lab = document.createElement('div')
      lab.className = 'settings-label'
      lab.textContent = t('settings.dropBehavior')
      const sel = document.createElement('select')
      sel.className = 'settings-select'
      for (const [val, txt] of [['open', t('settings.dropOpen')], ['link', t('settings.dropLink')]] as const) {
        const o = document.createElement('option')
        o.value = val
        o.textContent = txt
        if (settings.dropBehavior === val) o.selected = true
        sel.appendChild(o)
      }
      sel.addEventListener('change', () => set('dropBehavior', sel.value as 'open' | 'link'))
      row.appendChild(lab)
      row.appendChild(sel)
      content.appendChild(row)
    } else if (key === 'general') {
      const row = document.createElement('div')
      row.className = 'settings-row settings-row--col'
      const lab = document.createElement('div')
      lab.className = 'settings-label'
      lab.textContent = t('settings.language')
      const sel = document.createElement('select')
      sel.className = 'settings-select'
      for (const [val, txt] of [['zh', '中文'], ['en', 'English']] as const) {
        const o = document.createElement('option')
        o.value = val
        o.textContent = txt
        if (settings.language === val) o.selected = true
        sel.appendChild(o)
      }
      sel.addEventListener('change', () => set('language', sel.value as Lang))
      row.appendChild(lab)
      row.appendChild(sel)
      content.appendChild(row)

      const ver = document.createElement('div')
      ver.className = 'settings-block'
      ver.innerHTML = `<div class="settings-label">${t('settings.version')}</div><div class="settings-muted">MD Editor v${APP_VERSION} · by Wesley Yan</div>`
      content.appendChild(ver)

      const log = document.createElement('div')
      log.className = 'settings-block'
      const logTitle = document.createElement('div')
      logTitle.className = 'settings-label'
      logTitle.textContent = t('settings.changelog')
      log.appendChild(logTitle)
      for (const c of CHANGELOG) {
        const item = document.createElement('div')
        item.className = 'settings-changelog-item'
        item.innerHTML = `<b>v${c.version}</b> <span class="settings-muted">${c.date}</span><ul>${c.items.map((i) => `<li>${i}</li>`).join('')}</ul>`
        log.appendChild(item)
      }
      content.appendChild(log)
    } else if (key === 'image') {
      content.appendChild(checkbox(t('settings.imgPreferRelative'), 'imgPreferRelative'))
      content.appendChild(checkbox(t('settings.imgAddDotSlash'), 'imgAddDotSlash'))
      content.appendChild(checkbox(t('settings.imgAutoEscape'), 'imgAutoEscapeUrl'))
    } else {
      content.appendChild(checkbox(t('settings.exportKeepNav'), 'exportKeepNav'))
      content.appendChild(checkbox(t('settings.exportUseTheme'), 'exportUseTheme'))
    }
  }

  tabDefs.forEach((td, i) => {
    const b = document.createElement('button')
    b.className = 'settings-tab' + (i === 0 ? ' active' : '')
    b.textContent = td.label
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.settings-tab').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      renderTab(td.key)
    })
    tabs.appendChild(b)
  })

  renderTab('file')
  container.appendChild(tabs)
  container.appendChild(content)
  modal.body.appendChild(container)
}
