import { openModal } from './modal'
import { getLang } from './i18n'
import { APP_VERSION } from './settings'

interface Section {
  title: { zh: string; en: string }
  render: (en: boolean) => string
}

const SHORTCUTS: { keys: string; zh: string; en: string }[] = [
  { keys: 'Ctrl/⌘ + S', zh: '保存', en: 'Save' },
  { keys: 'Ctrl/⌘ + Shift + S', zh: '另存为', en: 'Save As' },
  { keys: 'Ctrl/⌘ + N', zh: '新建标签页', en: 'New tab' },
  { keys: 'Ctrl/⌘ + /', zh: '切换源码 / 预览', en: 'Toggle source / preview' },
  { keys: 'Ctrl/⌘ + F', zh: '查找与替换', en: 'Find & Replace' },
  { keys: 'Ctrl/⌘ + B', zh: '加粗', en: 'Bold' },
  { keys: 'Ctrl/⌘ + I', zh: '斜体', en: 'Italic' },
  { keys: 'Ctrl/⌘ + U', zh: '下划线', en: 'Underline' },
  { keys: 'Ctrl/⌘ + K', zh: '超链接', en: 'Link' },
  { keys: '双击注释 / Double-click', zh: '就地编辑注释', en: 'Edit a comment in place' },
  { keys: '右键 / Right-click', zh: '呼出编辑上下文菜单', en: 'Open the editing context menu' },
]

const FEATURES = {
  zh: [
    '两种编辑模式：内联所见即所得（WYSIWYG）与纯 Markdown 源码，随时切换。',
    '左侧三栏：文件树、大纲、注释导航（可显隐、可切换）。',
    '上菜单栏：文件 / 编辑 / 段落 / 格式 / 显示，覆盖常用操作。',
    '富语法：标题、列表、任务列表、表格、代码高亮、数学公式、Mermaid、提示框、YAML。',
    '表格：插入后点击表格上方浮动工具栏增删行列。',
    '本地文件：打开文件 / 文件夹、多标签页、拖入打开、图片保存到 assets/。',
    '查找替换（Ctrl/⌘ + F）：关键字搜索定位、单个替换、全文替换。',
    '导出：HTML（含 Mermaid）与 PDF（浏览器打印）。',
  ],
  en: [
    'Two editing modes: inline WYSIWYG and raw Markdown source, switchable anytime.',
    'Left sidebar: file tree, outline, and comment navigation.',
    'Top menu bar: File / Edit / Paragraph / Format / View.',
    'Rich syntax: headings, lists, tasks, tables, code highlight, math, Mermaid, callouts, YAML.',
    'Tables: a floating toolbar above a table adds/removes rows and columns.',
    'Local files: open file/folder, multiple tabs, drag-drop, images saved to assets/.',
    'Find & Replace (Ctrl/⌘ + F): keyword search + locate, replace one, replace all.',
    'Export: HTML (with Mermaid) and PDF (browser print).',
  ],
}

const COMMENT = {
  zh: [
    '用 <code>&lt;!-- --&gt;</code> 写<b>显性注释</b>，用 <code>&lt;%-- --%&gt;</code> 写<b>隐形注释</b>；两者在左侧「注释」栏分组、颜色区分。',
    '在「注释」栏每条注释可：<b>定位跳转、编辑、回复、删除、取消注释</b>——所有操作实时反映到文档。',
    '在文档里<b>双击</b>某条注释也可就地编辑。',
  ],
  en: [
    'Use <code>&lt;!-- --&gt;</code> for <b>visible</b> comments and <code>&lt;%-- --%&gt;</code> for <b>hidden</b> comments; both are grouped and color-coded in the Comments panel.',
    'For each comment you can <b>jump, edit, reply, delete, and un-comment</b> — every action reflects in the document instantly.',
    '<b>Double-click</b> a comment in the document to edit it in place.',
  ],
}

const SECTIONS: Section[] = [
  {
    title: { zh: '关于', en: 'About' },
    render: (en) =>
      `<p class="settings-muted">MD Editor v${APP_VERSION} — ${en ? 'a WYSIWYG Markdown editor whose signature feature is comment navigation. By Wesley Yan.' : '一个所见即所得的 Markdown 编辑器，核心特色是注释导航。作者 Wesley Yan。'}</p>`,
  },
  {
    title: { zh: '编辑模式', en: 'Editing Modes' },
    render: (en) =>
      `<p>${en ? 'Inline WYSIWYG and raw Markdown source. Toggle with the bottom-left button or <b>Ctrl/⌘ + /</b>.' : '内联所见即所得（WYSIWYG）与纯 Markdown 源码两种模式，点左下角按钮或按 <b>Ctrl/⌘ + /</b> 切换。'}</p>`,
  },
  {
    title: { zh: '注释导航（核心特色）', en: 'Comment Navigation (signature feature)' },
    render: (en) => `<ul class="help-list">${COMMENT[en ? 'en' : 'zh'].map((i) => `<li>${i}</li>`).join('')}</ul>`,
  },
  {
    title: { zh: '功能', en: 'Features' },
    render: (en) => `<ul class="help-list">${FEATURES[en ? 'en' : 'zh'].map((i) => `<li>${i}</li>`).join('')}</ul>`,
  },
  {
    title: { zh: '快捷键', en: 'Keyboard Shortcuts' },
    render: (en) =>
      `<table class="help-keys">${SHORTCUTS.map((s) => `<tr><td class="help-kbd">${s.keys}</td><td>${en ? s.en : s.zh}</td></tr>`).join('')}</table>`,
  },
  {
    title: { zh: '浏览器兼容', en: 'Browser Compatibility' },
    render: (en) =>
      `<p>${en ? 'Full features (open folder/file, save to disk) rely on the File System Access API — please use <b>Chrome or Edge</b>. Safari / Firefox have limited support and fall back to read-only / download-to-save.' : '完整功能（打开文件夹 / 文件、保存到本地）依赖 File System Access API，请使用 <b>Chrome 或 Edge</b>；Safari / Firefox 支持有限，会自动降级为只读 / 下载另存。'}</p>`,
  },
  {
    title: { zh: '技术栈与许可', en: 'Tech Stack & License' },
    render: (en) =>
      `<p class="settings-muted">${en ? 'Built on Milkdown (ProseMirror), CodeMirror 6, Mermaid and KaTeX, bundled into a single self-contained HTML. Open-sourced under the MIT License; all bundled libraries are MIT.' : '基于 Milkdown（ProseMirror）、CodeMirror 6、Mermaid、KaTeX 构建，打包为单个自包含 HTML。以 MIT 许可开源，所依赖的第三方库均为 MIT。'}</p>`,
  },
  {
    title: { zh: '免责声明', en: 'Disclaimer' },
    render: (en) =>
      `<p class="settings-muted">${en ? 'An independent open-source project, not affiliated with Typora, Obsidian, or any other Markdown editor. Trademarks belong to their respective owners.' : '独立开源项目，与 Typora、Obsidian 等任何其他 Markdown 编辑器无关联；相关商标归各自所有者所有。'}</p>`,
  },
]

export function openHelpDialog(): void {
  const en = getLang() === 'en'
  const modal = openModal(en ? 'Help' : '帮助', { width: 580 })
  const wrap = document.createElement('div')
  wrap.className = 'help'
  wrap.innerHTML = SECTIONS.map(
    (s) => `<section class="help-section"><h3>${en ? s.title.en : s.title.zh}</h3>${s.render(en)}</section>`
  ).join('')
  modal.body.appendChild(wrap)
}
