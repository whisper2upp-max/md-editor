import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './styles/app.css'
import './styles/print.css'

import { createEditor, type EditorHandle } from './editor/editor'
import { createCodeMode, cmUndo, cmRedo, type CodeMirrorHandle } from './editor/codemode'
import { editorViewCtx } from '@milkdown/kit/core'
import { collectComments, collectHeadings, scrollToPos } from './comments/collect'
import { extractComments, extractHeadings } from './comments/parse'
import { rawComment, type CommentKind } from './comments/node-comment'
import { fsSupported, pickDirectory, ensurePermission, readFile, writeFile, createFile, removeEntry, renameFile } from './fs/access'
import { saveLastDir, getLastDir, getRecent, type RecentEntry } from './fs/handles'
import type { TreeNode } from './fs/tree'
import { FileTreePanel } from './panels/filetree'
import { OutlinePanel, type OutlineItem } from './panels/outline'
import { CommentsNavPanel, type CommentNavItem, type CommentNavCallbacks } from './panels/comments-nav'
import { findCommentPos } from './comments/node-comment'
import { TabBar, createDoc, isDirty, type Doc, type EditorMode } from './tabs/tabs'
import { ImageManager } from './commands/images'
import { exportHTML, exportPDF } from './commands/export'
import { toast, confirmDialog, promptDialog, saveConfirmDialog } from './app/toast'
import { showMenu, closeMenu, type MenuItem } from './app/context-menu'
import { showEmojiPicker } from './app/emoji'
import { FindReplace, CodeSearchController, ProseSearchController, type SearchController } from './app/search'
import { TableToolbar } from './app/table-toolbar'
import type { TableOp } from './editor/editor'
import { loadSettings, saveSettings, openSettingsDialog, type Settings } from './app/settings'
import { openHelpDialog } from './app/help'
import { setLang, t } from './app/i18n'

type MenuName = 'file' | 'edit' | 'para' | 'format' | 'view'
type PanelName = 'files' | 'outline' | 'comments'

interface CommentRef {
  kind: CommentKind
  value: string
  pos?: number
  index?: number
  len?: number
}
interface HeadingRef {
  level: number
  text: string
  pos?: number
  line?: number
}

interface PasteTargetSnapshot {
  docId: string
  mode: EditorMode
  from: number
  to: number
}

const WELCOME = `# MD Editor

A **WYSIWYG** Markdown editor with instant preview and one-click switch to source mode.

## Comment Navigation

Use \`<!-- -->\` for **visible comments** and \`<%-- --%>\` for **hidden comments**. Both appear in the left **Comments** panel, where you can **edit, reply, delete, un-comment, and click to jump**.

<!-- This is a visible comment; click it in the Comments panel to jump here -->

Some text <%-- hidden note: TODO --%> continues here.

## Getting Started

- Top menu bar: File / Edit / Paragraph / Format / View
- Bottom-left button toggles Source / Preview
- Shortcuts: \`Ctrl/⌘ + S\` save · \`Ctrl/⌘ + /\` toggle mode · \`Ctrl/⌘ + F\` find & replace
- **Right-click** the editor for the context menu
- For full features (open folder / save to disk), use Chrome or Edge

## Features

| Feature | Status |
| --- | --- |
| Table | ✅ |
| Math | ✅ |
| Mermaid | ✅ |

- [x] Task list
- [ ] Todo

Inline math $E = mc^2$, block math:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

\`\`\`mermaid
graph LR
  A[Write] --> B{Comment}
  B --> C[Navigate]
\`\`\`

---

# MD Editor（中文）

一个**所见即所得（WYSIWYG）**的 Markdown 编辑器，支持即时预览与源码模式一键切换。

## 注释导航

用 \`<!-- -->\` 写**显性注释**，用 \`<%-- --%>\` 写**隐形注释**；两者都会出现在左侧「注释」栏，可**编辑、回复、删除、取消注释、点击跳转**。

<!-- 这是显性注释，点左侧「注释」栏可跳转到这里 -->

一段正文 <%-- 隐形注释：待补充 --%> 继续。

## 开始使用

- 顶部菜单栏：文件 / 编辑 / 段落 / 格式 / 显示
- 左下角按钮切换源码 / 预览模式
- 快捷键：\`Ctrl/⌘ + S\` 保存 · \`Ctrl/⌘ + /\` 切换模式 · \`Ctrl/⌘ + F\` 查找替换
- 在编辑区**右键**呼出编辑菜单
- 需要「打开文件夹 / 保存到本地」等完整功能，请用 Chrome 或 Edge

## 常用功能

| 功能 | 状态 |
| --- | --- |
| 表格 | ✅ |
| 数学公式 | ✅ |
| Mermaid 图表 | ✅ |

- [x] 任务列表
- [ ] 待办事项

行内公式 $E = mc^2$，块级公式：

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

\`\`\`mermaid
graph LR
  A[写作] --> B{注释}
  B --> C[导航]
\`\`\`
`

class App {
  private docs: Doc[] = []
  private activeId: string | null = null
  private editor!: EditorHandle
  private code!: CodeMirrorHandle
  private fileTree!: FileTreePanel
  private outline!: OutlinePanel
  private commentsNav!: CommentsNavPanel
  private tabBar!: TabBar
  private image = new ImageManager()

  private suppress = false
  private autoSave = false
  private autoSaveTimer: number | null = null
  private refreshTimer: number | null = null
  private clipboardReadState: PermissionState | 'unsupported' | null = null

  private comments: CommentRef[] = []
  private headings: HeadingRef[] = []
  private editingCommentKey: number | null = null

  private milkdownHost!: HTMLElement
  private codeHost!: HTMLElement
  private modeBtn!: HTMLButtonElement
  private autoSaveBtn!: HTMLButtonElement
  private findReplace!: FindReplace
  private codeSearch!: CodeSearchController
  private proseSearch!: ProseSearchController
  private tableToolbar!: TableToolbar
  private tableToolbarTimer: number | null = null
  private hoveredTable: HTMLElement | null = null
  private settings: Settings = loadSettings()

  async init(root: HTMLElement): Promise<void> {
    setLang(this.settings.language)
    this.image.setPrefs({ addDotSlash: this.settings.imgAddDotSlash })
    root.innerHTML = this.template()
    this.milkdownHost = root.querySelector('#milkdown-host')!
    this.codeHost = root.querySelector('#code-host')!

    this.setupSidebar(root)
    this.setupMenubar(root)

    this.tabBar = new TabBar(root.querySelector('#tabbar')!, {
      onSelect: (id) => this.setActive(id),
      onClose: (id) => this.closeDoc(id),
      onAdd: () => this.newDoc(),
    })
    this.fileTree = new FileTreePanel(root.querySelector('#panel-files')!, {
      onOpenFile: (node) => this.openTreeFile(node),
    })
    this.outline = new OutlinePanel(root.querySelector('#panel-outline')!, (i) => this.jumpHeading(i))
    const navCb: CommentNavCallbacks = {
      onJump: (i) => this.jumpComment(i),
      onEdit: (i) => this.startCommentEdit(i),
      onReply: (i) => this.replyComment(i),
      onDelete: (i) => this.deleteComment(i),
      onUncomment: (i) => this.uncommentComment(i),
      onEditSubmit: (i, v) => this.submitCommentEdit(i, v),
      onEditCancel: (i) => this.cancelCommentEdit(),
    }
    this.commentsNav = new CommentsNavPanel(root.querySelector('#panel-comments')!, navCb)

    this.editor = await createEditor({
      root: this.milkdownHost,
      defaultValue: WELCOME,
      onChange: (md) => this.onEditorChange(md),
      image: { onUpload: this.image.onUpload, proxyDomURL: this.image.proxyDomURL },
    })
    this.code = createCodeMode({
      parent: this.codeHost,
      onChange: (v) => this.onEditorChange(v),
    })

    this.codeSearch = new CodeSearchController(this.code.view)
    this.proseSearch = new ProseSearchController(() => this.editor.getView())
    this.findReplace = new FindReplace(root.querySelector('#editor-area')!, {
      getController: (): SearchController =>
        this.active?.mode === 'code' ? this.codeSearch : this.proseSearch,
    })

    this.tableToolbar = new TableToolbar((op) => {
      // Make sure the table op targets the hovered table (place caret inside it
      // if the current selection isn't already there), then run the command.
      if (this.hoveredTable) this.editor.ensureCaretInTable(this.hoveredTable)
      this.editor.tableOp(op)
      setTimeout(() => {
        const view = this.editor.getView()
        const el = view.domAtPos(view.state.selection.from).node as HTMLElement | null
        const tbl = (el?.nodeType === 3 ? el.parentElement : el)?.closest?.('table') as HTMLElement | null
        if (tbl) {
          this.hoveredTable = tbl
          this.tableToolbar.showFor(tbl)
        }
      }, 0)
    })

    const first = createDoc({ name: 'Welcome.md', content: WELCOME })
    this.docs.push(first)
    this.activeId = first.id
    this.captureCleanBaseline(first)
    this.renderTabs()
    this.refreshPanels()

    this.setupKeyboard()
    this.setupContextMenu()
    this.setupCommentEditing()
    this.setupTableToolbar()
    this.setupDragDrop(root)
    this.setupBeforeUnload()
    this.applyLanguage()
    if (!fsSupported()) {
      toast('当前浏览器不支持本地文件读写，请使用 Chrome 或 Edge', 'error', 5000)
    }
    void this.refreshClipboardReadPermission()
    this.tryRestoreRecent()
  }

  private template(): string {
    return `
      <div class="app-shell">
        <div class="menubar" id="menubar">
          <div class="menubar-left">
            <button class="menu-title" data-menu="file">文件</button>
            <button class="menu-title" data-menu="edit">编辑</button>
            <button class="menu-title" data-menu="para">段落</button>
            <button class="menu-title" data-menu="format">格式</button>
            <button class="menu-title" data-menu="view">显示</button>
          </div>
          <div class="menubar-right">
            <button class="menu-icon" data-act="autosave" id="autosave-btn" title="自动保存">自动保存: 关</button>
            <button class="menu-icon" data-act="theme" title="切换主题">🌓</button>
          </div>
        </div>
        <div class="body">
          <div class="sidebar" id="sidebar">
            <div class="sidebar-switch" id="sidebar-switch">
              <button data-panel="files" class="active">文件树</button>
              <button data-panel="outline">大纲</button>
              <button data-panel="comments">注释</button>
            </div>
            <div class="panel" id="panel-files"></div>
            <div class="panel" id="panel-outline" hidden></div>
            <div class="panel" id="panel-comments" hidden></div>
            <div class="sidebar-footer">
              <button id="mode-btn" data-act="mode" title="切换源码/预览 (Ctrl/Cmd+/)">&lt;/&gt; 源码模式</button>
            </div>
          </div>
          <div class="editor-col">
            <div class="tabbar-wrap">
              <div class="tabbar" id="tabbar"></div>
            </div>
            <div class="editor-area" id="editor-area">
              <div class="milkdown-host" id="milkdown-host"></div>
              <div class="code-host" id="code-host" hidden></div>
            </div>
          </div>
        </div>
      </div>`
  }

  private setupSidebar(root: HTMLElement): void {
    const sw = root.querySelector('#sidebar-switch')!
    sw.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
      if (!btn) return
      this.showPanel(btn.dataset.panel as PanelName)
    })
    root.querySelector('#mode-btn')!.addEventListener('click', () => this.toggleMode())
  }

  private showPanel(panel: PanelName): void {
    const sidebar = document.querySelector('#sidebar') as HTMLElement
    sidebar.hidden = false
    const sw = document.querySelector('#sidebar-switch')!
    sw.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('active', (b as HTMLButtonElement).dataset.panel === panel)
    )
    ;(['files', 'outline', 'comments'] as const).forEach((p) => {
      ;(document.querySelector(`#panel-${p}`) as HTMLElement).hidden = p !== panel
    })
  }

  private setupMenubar(root: HTMLElement): void {
    this.modeBtn = root.querySelector('#mode-btn')!
    this.autoSaveBtn = root.querySelector('#autosave-btn')!
    const menubar = root.querySelector('#menubar')!
    menubar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
      if (!btn) return
      if (btn.dataset.menu) {
        const rect = btn.getBoundingClientRect()
        this.menuAnchor = { x: rect.left, y: rect.bottom + 2 }
        showMenu(rect.left, rect.bottom + 2, this.buildMenu(btn.dataset.menu as MenuName))
      } else if (btn.dataset.act === 'autosave') {
        this.toggleAutoSave()
      } else if (btn.dataset.act === 'theme') {
        this.toggleTheme()
      }
    })
  }

  private get active(): Doc | null {
    return this.docs.find((d) => d.id === this.activeId) ?? null
  }

  private menuAnchor = { x: 40, y: 60 }

  private buildMenu(name: MenuName): MenuItem[] {
    if (name === 'file') {
      return [
        { label: t('file.openFile'), onClick: () => this.openSingleFile() },
        { label: t('file.openFolder'), onClick: () => this.openFolder() },
        { label: t('file.newTab'), shortcut: 'Ctrl+N', onClick: () => this.newDoc() },
        { sep: true },
        { label: t('file.save'), shortcut: 'Ctrl+S', onClick: () => this.saveActive() },
        { label: t('file.saveAs'), shortcut: 'Ctrl+Shift+S', onClick: () => this.saveAsActive() },
        { sep: true },
        { label: t('file.exportHtml'), onClick: () => this.doExportHTML() },
        { label: t('file.exportPdf'), onClick: () => this.doExportPDF() },
        { sep: true },
        { label: t('file.settings'), onClick: () => this.openSettings() },
        { label: t('file.help'), onClick: () => openHelpDialog() },
        { label: t('file.close'), onClick: () => this.closeProgram() },
      ]
    }
    if (name === 'edit') {
      return [
        { label: t('edit.undo'), shortcut: 'Ctrl+Z', onClick: () => this.editUndo() },
        { label: t('edit.redo'), shortcut: 'Ctrl+Y', onClick: () => this.editRedo() },
        { sep: true },
        { label: t('edit.cut'), shortcut: 'Ctrl+X', onClick: () => this.editClipboard('cut') },
        { label: t('edit.copy'), shortcut: 'Ctrl+C', onClick: () => this.editClipboard('copy') },
        { label: t('edit.paste'), shortcut: 'Ctrl+V', onClick: () => this.execPaste() },
        { label: t('edit.pasteImage'), onClick: () => this.pasteImage() },
        { label: t('edit.pastePlain'), onClick: () => this.execPastePlain() },
        { sep: true },
        { label: t('edit.copyPlain'), onClick: () => this.execCopyPlain() },
        { label: t('edit.copyMd'), onClick: () => this.copyAsMarkdown() },
        { label: t('edit.copyHtml'), onClick: () => this.copyAsHTML() },
        { sep: true },
        { label: t('edit.emoji'), onClick: () => this.openEmoji() },
      ]
    }
    if (name === 'para') {
      return [
        {
          label: t('para.heading'),
          submenu: [
            { label: 'H1', onClick: () => this.execHeading(1) },
            { label: 'H2', onClick: () => this.execHeading(2) },
            { label: 'H3', onClick: () => this.execHeading(3) },
            { label: 'H4', onClick: () => this.execHeading(4) },
            { label: 'H5', onClick: () => this.execHeading(5) },
            { label: 'H6', onClick: () => this.execHeading(6) },
            { sep: true },
            { label: t('para.paragraph'), onClick: () => this.execParagraph() },
          ],
        },
        { sep: true },
        { label: t('para.table'), onClick: () => this.insertTable() },
        {
          label: t('para.tableEdit'),
          submenu: [
            { label: '↑ ' + t('para.table'), onClick: () => this.tableOp('rowBefore') },
            { label: '↓ ' + t('para.table'), onClick: () => this.tableOp('rowAfter') },
            { label: '← ' + t('para.table'), onClick: () => this.tableOp('colBefore') },
            { label: '→ ' + t('para.table'), onClick: () => this.tableOp('colAfter') },
            { sep: true },
            { label: '✕ 行 / row', onClick: () => this.tableOp('delRow') },
            { label: '✕ 列 / col', onClick: () => this.tableOp('delCol') },
          ],
        },
        { sep: true },
        { label: t('para.formula'), onClick: () => this.insertFormula() },
        {
          label: t('para.admonition'),
          submenu: [
            { label: '📘 NOTE', onClick: () => this.insertAdmonition('NOTE') },
            { label: '💡 TIP', onClick: () => this.insertAdmonition('TIP') },
            { label: '❗ IMPORTANT', onClick: () => this.insertAdmonition('IMPORTANT') },
            { label: '⚠️ WARNING', onClick: () => this.insertAdmonition('WARNING') },
            { label: '🛑 CAUTION', onClick: () => this.insertAdmonition('CAUTION') },
          ],
        },
        { label: t('para.hr'), onClick: () => this.insertHr() },
        { label: t('para.yaml'), onClick: () => this.insertYaml() },
        {
          label: t('para.list'),
          submenu: [
            { label: '• ' + t('para.list'), onClick: () => this.insertList('bullet') },
            { label: '1. ' + t('para.list'), onClick: () => this.insertList('ordered') },
            { label: '☑ ' + t('para.list'), onClick: () => this.insertList('task') },
          ],
        },
        { label: t('para.image'), onClick: () => this.insertImagePrompt() },
      ]
    }
    if (name === 'format') {
      return [
        { label: t('format.bold'), shortcut: 'Ctrl+B', onClick: () => this.execBold() },
        { label: t('format.italic'), shortcut: 'Ctrl+I', onClick: () => this.execItalic() },
        { label: t('format.underline'), shortcut: 'Ctrl+U', onClick: () => this.execUnderline() },
        { label: t('format.code'), onClick: () => this.execInlineCode() },
        { label: t('format.strike'), onClick: () => this.execStrike() },
        { sep: true },
        { label: t('format.link'), shortcut: 'Ctrl+K', onClick: () => this.execLink() },
        {
          label: t('format.comment'),
          submenu: [
            { label: '插入显性注释 (<!-- -->)', onClick: () => this.execInsertComment('html') },
            { label: '插入隐形注释 (<%-- --%>)', onClick: () => this.execInsertComment('tmpl') },
            { sep: true },
            { label: '选中文字套显性注释', onClick: () => this.execWrapComment('html') },
            { label: '选中文字套隐形注释', onClick: () => this.execWrapComment('tmpl') },
          ],
        },
      ]
    }
    // view
    return [
      { label: t('view.toggleSidebar'), onClick: () => this.toggleSidebar() },
      { sep: true },
      { label: t('panel.outline'), onClick: () => this.showPanel('outline') },
      { label: t('panel.files'), onClick: () => this.showPanel('files') },
      { label: t('panel.comments'), onClick: () => this.showPanel('comments') },
      { sep: true },
      { label: t('view.toggleMode'), shortcut: 'Ctrl+/', onClick: () => this.toggleMode() },
    ]
  }

  private openSettings(): void {
    openSettingsDialog(this.settings, (s, changed) => {
      saveSettings(s)
      if (changed === 'language') {
        setLang(s.language)
        this.applyLanguage()
      } else if (changed === 'imgAddDotSlash') {
        this.image.setPrefs({ addDotSlash: s.imgAddDotSlash })
      }
    })
  }

  private applyLanguage(): void {
    document.querySelectorAll<HTMLElement>('.menu-title').forEach((b) => {
      const m = b.dataset.menu as MenuName
      b.textContent = t(`menu.${m}`)
    })
    document.querySelectorAll<HTMLButtonElement>('#sidebar-switch button').forEach((b) => {
      const p = b.dataset.panel as PanelName
      b.textContent = t(`panel.${p}`)
    })
    this.autoSaveBtn.textContent = this.autoSave ? t('toolbar.autosaveOn') : t('toolbar.autosaveOff')
    this.modeBtn.textContent = this.active?.mode === 'code' ? t('mode.toPreview') : t('mode.toSource')
  }

  // --- file menu actions ---

  private async saveAsActive(): Promise<void> {
    const doc = this.active
    if (!doc) return
    const content = this.getActiveContent()
    const handle = await this.saveAsPicker(doc.name)
    if (!handle) return
    doc.fileHandle = handle
    doc.name = handle.name
    doc.path = handle.name
    doc.content = content
    try {
      await writeFile(handle, content)
      doc.savedContent = content
      this.renderTabs()
      toast('已另存为', 'success', 1200)
    } catch (e) {
      toast(`另存失败：${(e as Error).message}`, 'error')
    }
  }

  private closeProgram(): void {
    if (this.docs.some((d) => isDirty(d)) && !confirmDialog('有未保存的修改，确定关闭程序吗？')) return
    window.close()
    setTimeout(() => toast('浏览器阻止了自动关闭，请手动关闭此标签页', 'info', 3000), 200)
  }

  // --- edit menu actions ---

  private editUndo(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.undo()
    else cmUndo(this.code.view)
  }
  private editRedo(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.redo()
    else cmRedo(this.code.view)
  }

  private editClipboard(kind: 'cut' | 'copy'): void {
    if (this.active?.mode === 'wysiwyg') this.editor.focus()
    else this.code.focus()
    setTimeout(() => {
      try {
        const ok = document.execCommand(kind)
        if (!ok) toast('请使用快捷键完成此操作', 'info', 1600)
      } catch {
        toast('请使用快捷键完成此操作', 'info', 1600)
      }
    }, 0)
  }

  private async execPaste(): Promise<void> {
    const target = this.capturePasteTarget()
    closeMenu()
    if (!target) return
    if (!navigator.clipboard?.readText) {
      toast('当前环境不支持直接读取剪贴板', 'error')
      this.refocusPasteTarget(target)
      return
    }
    try {
      const state = await this.refreshClipboardReadPermission()
      if (state === 'denied') {
        toast('剪贴板权限已被拒绝，请在浏览器站点设置中允许', 'error', 3600)
        this.refocusPasteTarget(target)
        return
      }
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast('剪贴板为空', 'info', 1400)
        this.refocusPasteTarget(target)
        return
      }
      if (target.mode === 'wysiwyg' && this.activeId === target.docId && this.active?.mode === 'wysiwyg') {
        this.editor.insertMarkdownAt(target.from, target.to, text)
      } else {
        this.insertPlainTextAt(target, text)
      }
    } catch {
      await this.refreshClipboardReadPermission()
      this.refocusPasteTarget(target)
      toast('浏览器未允许读取剪贴板，请允许后重试', 'error', 2600)
    }
  }

  private async pasteImage(): Promise<void> {
    closeMenu()
    if (!this.image.hasDir()) {
      toast('请先「打开文件夹」，图片才能保存到本地后再插入', 'error', 3000)
      return
    }
    const clip = navigator.clipboard as unknown as { read?: () => Promise<ClipboardItem[]> }
    if (!clip.read) {
      toast('当前环境不支持读取剪贴板图片', 'error')
      return
    }
    try {
      const items = await clip.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          const ext = type.split('/')[1] || 'png'
          const file = new File([blob], `pasted.${ext}`, { type })
          const path = await this.image.onUpload(file)
          this.insertMd(`![](${path})`, false)
          toast('已粘贴图片', 'success', 1000)
          return
        }
      }
      toast('剪贴板里没有图片', 'info', 1600)
    } catch (e) {
      if ((e as Error).name === 'NoImageDirError') return
      toast('读取剪贴板图片失败', 'error')
    }
  }

  private async copyAsMarkdown(): Promise<void> {
    const md = this.getActiveContent()
    await navigator.clipboard.writeText(md).catch(() => {})
    toast('已复制为 Markdown', 'success', 1000)
  }

  private async copyAsHTML(): Promise<void> {
    if (this.active?.mode === 'code') {
      this.suppress = true
      this.editor.setMarkdown(this.code.getValue())
      this.suppress = false
    }
    const html = this.editor.getHTML()
    await navigator.clipboard.writeText(html).catch(() => {})
    toast('已复制为 HTML 代码', 'success', 1000)
  }

  private openEmoji(): void {
    showEmojiPicker(this.menuAnchor.x, this.menuAnchor.y, (s) => {
      if (this.active?.mode === 'wysiwyg') this.editor.insertMarkdown(s, true)
      else this.code.insertText(s)
    })
  }

  // --- paragraph menu actions ---

  private insertMd(md: string, inline = false): void {
    if (this.active?.mode === 'wysiwyg') this.editor.insertMarkdown(md, inline)
    else this.code.insertText(md)
  }

  private insertTable(): void {
    this.insertMd('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 　 | 　 | 　 |\n\n')
  }

  private tableOp(op: import('./editor/editor').TableOp): void {
    if (this.active?.mode !== 'wysiwyg') {
      toast('请在预览模式下编辑表格', 'info', 2000)
      return
    }
    this.editor.tableOp(op)
  }

  private insertFormula(): void {
    this.insertMd('\n$$\n\n$$\n')
  }

  private insertAdmonition(type: string): void {
    this.insertMd(`\n> [!${type}]\n> 在此输入内容\n\n`)
  }

  private insertHr(): void {
    this.insertMd('\n---\n')
  }

  private insertYaml(): void {
    const yaml = '---\ntitle: \ndate: \nauthor: \n---\n\n'
    if (this.active?.mode === 'code') {
      const cur = this.code.getValue()
      this.suppress = true
      this.code.setValue(yaml + cur)
      this.suppress = false
      this.onEditorChange(this.code.getValue())
    } else {
      const cur = this.editor.getMarkdown()
      this.suppress = true
      this.editor.setMarkdown(yaml + cur)
      this.suppress = false
      this.onEditorChange(this.editor.getMarkdown())
    }
  }

  private insertList(kind: 'bullet' | 'ordered' | 'task'): void {
    if (this.active?.mode === 'wysiwyg') {
      if (kind === 'bullet') this.editor.bulletList()
      else if (kind === 'ordered') this.editor.orderedList()
      else this.editor.insertMarkdown('- [ ] 任务项')
    } else {
      const snippet = kind === 'bullet' ? '\n- 列表项' : kind === 'ordered' ? '\n1. 列表项' : '\n- [ ] 任务项'
      this.code.insertText(snippet)
    }
  }

  private insertImagePrompt(): void {
    const url = promptDialog('图片地址或相对路径：', 'assets/')
    if (!url) return
    const finalUrl = this.settings.imgAutoEscapeUrl ? url.replace(/ /g, '%20') : url
    this.insertMd(`![](${finalUrl})`, false)
  }

  // --- format menu actions ---

  private execUnderline(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.toggleUnderline()
    else this.code.wrapSelection('<u>', '</u>')
  }
  private execStrike(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.toggleStrike()
    else this.code.wrapSelection('~~', '~~')
  }
  private execLink(): void {
    if (this.active?.mode === 'wysiwyg') {
      this.editor.toggleLink()
    } else {
      const sel = this.code.getSelectedText() || '链接文字'
      this.code.wrapSelection('[', `](https://)`)
      void sel
    }
  }

  // --- view menu actions ---

  private toggleSidebar(): void {
    const sidebar = document.querySelector('#sidebar') as HTMLElement
    sidebar.hidden = !sidebar.hidden
  }

  private openFind(): void {
    const sel =
      this.active?.mode === 'code' ? this.code.getSelectedText() : this.editor.getSelectedText()
    this.findReplace.open(sel || undefined)
  }


  private renderTabs(): void {
    this.tabBar.render(this.docs, this.activeId)
  }

  // --- editor change / panels ---

  private onEditorChange(md: string): void {
    if (this.suppress) return
    const doc = this.active
    if (!doc) return
    doc.content = md
    this.renderTabs()
    this.scheduleRefresh()
    this.scheduleAutoSave()
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = window.setTimeout(() => this.refreshPanels(), 250)
  }

  private refreshPanels(): void {
    const doc = this.active
    if (!doc) return
    if (doc.mode === 'wysiwyg') {
      const view = this.editor.getView()
      this.comments = collectComments(view).map((c) => ({ kind: c.kind, value: c.value, pos: c.pos }))
      this.headings = collectHeadings(view).map((h) => ({ level: h.level, text: h.text, pos: h.pos }))
    } else {
      const text = this.code.getValue()
      this.comments = extractComments(text).map((c) => ({
        kind: c.kind,
        value: c.value,
        index: c.index,
        len: rawComment(c.kind, c.value).length,
      }))
      this.headings = extractHeadings(text).map((h) => ({ level: h.level, text: h.text, line: h.line }))
    }
    const outlineItems: OutlineItem[] = this.headings.map((h, i) => ({ level: h.level, text: h.text, key: i }))
    const commentItems: CommentNavItem[] = this.comments.map((c, i) => ({ kind: c.kind, value: c.value, key: i }))
    this.outline.render(outlineItems)
    this.commentsNav.render(commentItems)
  }

  private jumpComment(i: number): void {
    const ref = this.comments[i]
    if (!ref) return
    if (this.active?.mode === 'wysiwyg' && ref.pos != null) {
      scrollToPos(this.editor.getView(), ref.pos)
    } else if (ref.index != null) {
      this.code.scrollToRange(ref.index, ref.index + (ref.len ?? 0))
    }
  }

  private jumpHeading(i: number): void {
    const ref = this.headings[i]
    if (!ref) return
    if (this.active?.mode === 'wysiwyg' && ref.pos != null) {
      scrollToPos(this.editor.getView(), ref.pos)
    } else if (ref.line != null) {
      this.code.scrollToLine(ref.line)
    }
  }

  // --- mode ---

  private async toggleMode(): Promise<void> {
    const doc = this.active
    if (!doc) return
    if (doc.mode === 'wysiwyg') {
      doc.content = this.editor.getMarkdown()
      this.suppress = true
      this.code.setValue(doc.content)
      this.suppress = false
      doc.mode = 'code'
      this.milkdownHost.hidden = true
      this.codeHost.hidden = false
      this.modeBtn.textContent = t('mode.toPreview')
      this.hideTableToolbar()
      this.code.focus()
    } else {
      doc.content = this.code.getValue()
      doc.mode = 'wysiwyg'
      this.milkdownHost.hidden = false
      this.codeHost.hidden = true
      this.modeBtn.textContent = t('mode.toSource')
      this.suppress = true
      this.editor.setMarkdown(doc.content)
      this.suppress = false
      this.editor.focus()
    }
    this.refreshPanels()
  }

  private applyModeUI(mode: EditorMode): void {
    this.milkdownHost.hidden = mode === 'code'
    this.codeHost.hidden = mode === 'wysiwyg'
    this.modeBtn.textContent = mode === 'code' ? t('mode.toPreview') : t('mode.toSource')
    if (mode === 'code') this.hideTableToolbar()
  }

  // --- docs / tabs ---

  private newDoc(): void {
    const doc = createDoc({ name: '未命名.md', content: '' })
    this.docs.push(doc)
    this.setActive(doc.id)
    this.renderTabs()
  }

  private setActive(id: string): void {
    if (this.activeId === id) return
    const doc = this.docs.find((d) => d.id === id)
    if (!doc) return
    const outgoing = this.active
    if (this.settings.autoSaveOnSwitch && outgoing && outgoing.fileHandle && isDirty(outgoing)) {
      void this.saveDoc(outgoing)
    }
    const wasClean = !isDirty(doc)
    this.activeId = id
    this.suppress = true
    if (doc.mode === 'wysiwyg') this.editor.setMarkdown(doc.content)
    else this.code.setValue(doc.content)
    this.suppress = false
    if (wasClean) this.captureCleanBaseline(doc)
    this.applyModeUI(doc.mode)
    this.renderTabs()
    this.fileTree.setActive(doc.path)
    this.refreshPanels()
    this.hideTableToolbar()
  }

  /**
   * Loading content into Milkdown/CodeMirror normalizes the markdown, which would
   * otherwise make a freshly-loaded (unedited) doc look "dirty". Capture that
   * normalized text as the saved baseline *synchronously*, right after load, so
   * there is no timer window in which a user edit could be absorbed into the
   * baseline (which would silently drop unsaved changes).
   */
  private captureCleanBaseline(doc: Doc): void {
    const md = doc.mode === 'wysiwyg' ? this.editor.getMarkdown() : this.code.getValue()
    doc.content = md
    doc.savedContent = md
  }

  private async closeDoc(id: string): Promise<void> {
    const idx = this.docs.findIndex((d) => d.id === id)
    if (idx < 0) return
    const doc = this.docs[idx]
    if (isDirty(doc)) {
      const choice = await saveConfirmDialog(`是否保存对「${doc.name}」的修改？`)
      if (choice === 'cancel') return
      if (choice === 'save') {
        const ok = await this.saveDoc(doc)
        if (!ok) return
      }
    }
    this.docs.splice(idx, 1)
    if (this.docs.length === 0) {
      const fresh = createDoc({ name: '未命名.md', content: '' })
      this.docs.push(fresh)
      this.activeId = null
      this.setActive(fresh.id)
    } else if (this.activeId === id) {
      this.activeId = null
      this.setActive(this.docs[Math.max(0, idx - 1)].id)
    }
    this.renderTabs()
  }

  private getActiveContent(): string {
    const doc = this.active
    if (!doc) return ''
    return doc.mode === 'wysiwyg' ? this.editor.getMarkdown() : this.code.getValue()
  }

  // --- file system ---

  private async openFolder(): Promise<void> {
    if (!fsSupported()) {
      toast('浏览器不支持文件夹访问', 'error')
      return
    }
    const dir = await pickDirectory()
    if (!dir) return
    await this.mountDir(dir)
    await saveLastDir(dir)
  }

  private async mountDir(dir: FileSystemDirectoryHandle): Promise<void> {
    this.image.setDir(dir)
    await this.fileTree.setRoot(dir)
    toast(`已打开文件夹：${dir.name}`, 'success')
  }

  private async openTreeFile(node: TreeNode): Promise<void> {
    const existing = this.docs.find((d) => d.path === node.path && d.fileHandle)
    if (existing) {
      this.setActive(existing.id)
      return
    }
    try {
      const handle = node.handle as FileSystemFileHandle
      const content = await readFile(handle)
      const doc = createDoc({
        name: node.name,
        content,
        savedContent: content,
        fileHandle: handle,
        parentDir: node.parent,
        path: node.path,
      })
      this.docs.push(doc)
      this.setActive(doc.id)
      this.renderTabs()
      this.fileTree.setActive(node.path)
    } catch (e) {
      toast(`打开失败：${(e as Error).message}`, 'error')
    }
  }

  private async saveActive(): Promise<void> {
    const doc = this.active
    if (!doc) return
    await this.saveDoc(doc)
  }

  /** Save a specific document (may not be the active one). Returns success. */
  private async saveDoc(doc: Doc): Promise<boolean> {
    const content = doc.id === this.activeId ? this.getActiveContent() : doc.content
    doc.content = content
    try {
      if (!doc.fileHandle) {
        const handle = await this.saveAsPicker(doc.name)
        if (!handle) return false
        doc.fileHandle = handle
        doc.name = handle.name
        doc.path = handle.name
      }
      await writeFile(doc.fileHandle, content)
      doc.savedContent = content
      this.renderTabs()
      toast('已保存', 'success', 1200)
      return true
    } catch (e) {
      toast(`保存失败：${(e as Error).message}`, 'error')
      return false
    }
  }

  private async saveAsPicker(suggested: string): Promise<FileSystemFileHandle | null> {
    const w = window as unknown as {
      showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>
    }
    if (!w.showSaveFilePicker) {
      toast('浏览器不支持另存为', 'error')
      return null
    }
    try {
      return await w.showSaveFilePicker({
        suggestedName: suggested,
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      })
    } catch {
      return null
    }
  }

  private scheduleAutoSave(): void {
    if (!this.autoSave) return
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer)
    this.autoSaveTimer = window.setTimeout(() => {
      const doc = this.active
      if (doc && doc.fileHandle && isDirty(doc)) this.saveActive()
    }, 1500)
  }

  private toggleAutoSave(): void {
    this.autoSave = !this.autoSave
    this.autoSaveBtn.textContent = this.autoSave ? t('toolbar.autosaveOn') : t('toolbar.autosaveOff')
    this.autoSaveBtn.classList.toggle('on', this.autoSave)
    if (this.autoSave) this.scheduleAutoSave()
  }

  // --- context menu / file ops ---

  private showFileContext(node: TreeNode | null, x: number, y: number): void {
    const items: MenuItem[] = []
    const rootDir = this.fileTree.getRoot()
    const targetDir =
      node?.kind === 'directory'
        ? (node.handle as FileSystemDirectoryHandle)
        : node?.parent ?? rootDir

    if (targetDir) {
      items.push({ label: '新建文档', onClick: () => this.createEntry(targetDir, 'file') })
      items.push({ label: '新建文件夹', onClick: () => this.createEntry(targetDir, 'dir') })
    }
    if (node) {
      if (node.kind === 'file') items.push({ label: '重命名', onClick: () => this.renameEntry(node) })
      items.push({ label: '删除', onClick: () => this.deleteEntry(node) })
    }
    showMenu(x, y, items)
  }

  private showEditorContext(x: number, y: number): void {
    // Move the caret to the right-click position (unless the click is inside an
    // existing selection) so paste/insert operations act where the user clicked.
    if (this.active?.mode === 'wysiwyg') this.editor.caretAtCoords(x, y)
    else this.code.caretAtCoords(x, y)

    const inWysiwyg = this.active?.mode === 'wysiwyg'

    const headingItems: MenuItem[] = [
      { label: '一级标题 H1', onClick: () => this.execHeading(1) },
      { label: '二级标题 H2', onClick: () => this.execHeading(2) },
      { label: '三级标题 H3', onClick: () => this.execHeading(3) },
      { label: '四级标题 H4', onClick: () => this.execHeading(4) },
      { label: '五级标题 H5', onClick: () => this.execHeading(5) },
      { label: '六级标题 H6', onClick: () => this.execHeading(6) },
      { sep: true },
      { label: '正文（段落）', onClick: () => this.execParagraph() },
    ]

    const items: MenuItem[] = [
      {
        label: '设为标题层级',
        submenu: headingItems,
      },
      { sep: true },
      {
        label: '加粗',
        shortcut: 'Ctrl+B',
        onClick: () => this.execBold(),
      },
      {
        label: '斜体',
        shortcut: 'Ctrl+I',
        onClick: () => this.execItalic(),
      },
      {
        label: '行内代码',
        shortcut: 'Ctrl+`',
        onClick: () => this.execInlineCode(),
      },
      {
        label: '插入代码块',
        onClick: () => this.execCodeBlock(),
      },
      { sep: true },
      {
        label: '插入显性注释 (<!-- -->)',
        onClick: () => this.execInsertComment('html'),
      },
      {
        label: '插入隐形注释 (<%-- --%>)',
        onClick: () => this.execInsertComment('tmpl'),
      },
      {
        label: '套上显性注释',
        onClick: () => this.execWrapComment('html'),
      },
      {
        label: '套上隐形注释',
        onClick: () => this.execWrapComment('tmpl'),
      },
      { sep: true },
      {
        label: '复制为纯文本',
        onClick: () => this.execCopyPlain(),
      },
      {
        label: '粘贴为纯文本',
        onClick: () => this.execPastePlain(),
      },
      { sep: true },
      {
        label: '表情与符号',
        onClick: () => {
          this.menuAnchor = { x, y }
          this.openEmoji()
        },
      },
    ]
    showMenu(x, y, items)
  }

  private execHeading(level: number): void {
    if (this.active?.mode === 'wysiwyg') {
      this.editor.setHeading(level)
    } else {
      this.code.setHeadingLevel(level)
    }
  }

  private execParagraph(): void {
    if (this.active?.mode === 'wysiwyg') {
      this.editor.setParagraph()
    } else {
      this.code.setHeadingLevel(0)
    }
  }

  private execBold(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.toggleBold()
    else this.code.wrapSelection('**', '**')
  }

  private execItalic(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.toggleItalic()
    else this.code.wrapSelection('_', '_')
  }

  private execInlineCode(): void {
    if (this.active?.mode === 'wysiwyg') this.editor.toggleInlineCode()
    else this.code.wrapSelection('`', '`')
  }

  private execCodeBlock(): void {
    if (this.active?.mode === 'wysiwyg') {
      this.editor.createCodeBlock()
    } else {
      const sel = this.code.getSelectedText()
      this.code.insertText(`\n\`\`\`\n${sel}\n\`\`\`\n`)
    }
  }

  private execWrapComment(kind: CommentKind): void {
    if (this.active?.mode === 'wysiwyg') {
      this.editor.wrapComment(kind)
    } else {
      const sel = this.code.getSelectedText()
      const wrapper = kind === 'tmpl' ? `<%--${sel}--%>` : `<!--${sel}-->`
      this.code.insertText(wrapper)
    }
  }

  private execInsertComment(kind: CommentKind): void {
    if (this.active?.mode === 'wysiwyg') {
      this.editor.insertComment(kind)
    } else {
      const wrapper = kind === 'tmpl' ? '<%----%>' : '<!---->'
      this.code.insertText(wrapper)
    }
  }

  private async execCopyPlain(): Promise<void> {
    if (this.active?.mode === 'wysiwyg') {
      await this.editor.copyPlainText()
    } else {
      const t = this.code.getSelectedText()
      if (t) await navigator.clipboard.writeText(t).catch(() => {})
    }
    toast('已复制', 'success', 1000)
  }

  private setupCommentEditing(): void {
    this.milkdownHost.addEventListener('dblclick', (e) => {
      const target = (e.target as HTMLElement).closest('.md-comment') as HTMLElement | null
      if (!target) return
      e.stopPropagation()
      const view = this.editor.getView()
      const pos = findCommentPos(view, target)
      if (pos == null) return
      const node = view.state.doc.nodeAt(pos)
      if (!node || node.type.name !== 'comment') return
      this.showCommentEditPopup(target, node.attrs.kind as CommentKind, node.attrs.value as string, pos)
    })
  }

  private setupTableToolbar(): void {
    const host = this.milkdownHost
    const clearHide = () => {
      if (this.tableToolbarTimer) {
        clearTimeout(this.tableToolbarTimer)
        this.tableToolbarTimer = null
      }
    }
    const scheduleHide = () => {
      clearHide()
      this.tableToolbarTimer = window.setTimeout(() => {
        this.hoveredTable = null
        this.tableToolbar.hide()
      }, 200)
    }

    host.addEventListener('mousemove', (e) => {
      if (this.active?.mode !== 'wysiwyg') return
      const target = e.target as HTMLElement
      const cell = target.closest(
        '.milkdown-table-block table td, .milkdown-table-block table th'
      ) as HTMLElement | null
      const table = cell ? (cell.closest('table') as HTMLElement | null) : null
      if (table) {
        clearHide()
        this.hoveredTable = table
        this.tableToolbar.showFor(table)
      } else if (this.tableToolbar.isVisible()) {
        scheduleHide()
      }
    })
    host.addEventListener('mouseleave', scheduleHide)

    // Keep it visible while the pointer is over the toolbar itself.
    this.tableToolbar.el.addEventListener('mouseenter', clearHide)
    this.tableToolbar.el.addEventListener('mouseleave', scheduleHide)

    // Reposition to the hovered table on scroll; hide if it scrolled away.
    host.addEventListener(
      'scroll',
      () => {
        if (this.hoveredTable && this.tableToolbar.isVisible()) {
          this.tableToolbar.showFor(this.hoveredTable)
        }
      },
      true
    )
    window.addEventListener('resize', () => {
      if (this.hoveredTable && this.tableToolbar.isVisible()) {
        this.tableToolbar.showFor(this.hoveredTable)
      }
    })
  }

  private hideTableToolbar(): void {
    this.hoveredTable = null
    this.tableToolbar.hide()
  }

  private setupDragDrop(root: HTMLElement): void {
    const area = root.querySelector('#editor-area')!
    const stop = (e: Event) => { e.preventDefault(); e.stopPropagation() }
    ;['dragenter', 'dragover'].forEach((ev) => area.addEventListener(ev, (e) => { stop(e); (area as HTMLElement).classList.add('drag-over') }))
    ;['dragleave', 'drop'].forEach((ev) => area.addEventListener(ev, (e) => { stop(e); (area as HTMLElement).classList.remove('drag-over') }))
    area.addEventListener('drop', (e) => this.handleDrop(e as DragEvent))
  }

  private async handleDrop(e: DragEvent): Promise<void> {
    const dt = e.dataTransfer
    if (!dt) return
    const items = Array.from(dt.items || [])
    const asHandle = async (it: DataTransferItem) => {
      const anyIt = it as unknown as { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }
      return anyIt.getAsFileSystemHandle ? await anyIt.getAsFileSystemHandle() : null
    }
    const link = this.settings.dropBehavior === 'link'
    let handled = false
    for (const it of items) {
      if (it.kind !== 'file') continue
      const handle = await asHandle(it).catch(() => null)
      if (handle && handle.kind === 'directory') {
        const dir = handle as FileSystemDirectoryHandle
        this.image.setDir(dir)
        await this.fileTree.setRoot(dir)
        await saveLastDir(dir)
        toast(`已打开文件夹：${dir.name}`, 'success')
        handled = true
      } else if (handle && handle.kind === 'file') {
        const fh = handle as FileSystemFileHandle
        if (link) {
          const isImg = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fh.name)
          this.insertMd(`${isImg ? '!' : ''}[${fh.name}](${fh.name})`, !isImg)
        } else {
          const content = await readFile(fh)
          const d = createDoc({ name: fh.name, content, savedContent: content, fileHandle: fh, path: fh.name })
          this.docs.push(d)
          this.setActive(d.id)
          this.renderTabs()
        }
        handled = true
      } else {
        // Fallback: plain File (no handle) — insert name or open content
        const file = it.getAsFile()
        if (file) {
          if (link) this.insertMd(`[${file.name}](${file.name})`, true)
          else {
            const content = await file.text()
            const d = createDoc({ name: file.name, content, savedContent: content, path: file.name })
            this.docs.push(d)
            this.setActive(d.id)
            this.renderTabs()
          }
          handled = true
        }
      }
    }
    if (!handled) toast('未能识别拖入的内容', 'info', 1600)
  }

  private showCommentEditPopup(
    anchor: HTMLElement,
    kind: CommentKind,
    currentValue: string,
    pos: number
  ): void {
    const overlay = document.createElement('div')
    overlay.className = 'comment-edit-overlay'
    const rect = anchor.getBoundingClientRect()
    overlay.style.cssText = `
      position:fixed; z-index:1500;
      left:${rect.left}px; top:${Math.min(rect.bottom + 4, window.innerHeight - 160)}px;
      min-width:280px; max-width:400px;
      background:var(--bg); border:1px solid var(--bd); border-radius:10px;
      box-shadow:0 8px 30px rgba(0,0,0,.2); padding:8px; color:var(--fg); font-size:13px;
    `
    const input = document.createElement('textarea')
    input.value = currentValue
    input.style.cssText = 'width:100%;min-height:60px;border:1px solid var(--bd);border-radius:6px;padding:6px 8px;font-size:13px;font-family:inherit;resize:vertical;background:var(--bg);color:var(--fg);'
    overlay.appendChild(input)
    const toolbar = document.createElement('div')
    toolbar.style.cssText = 'display:flex;gap:6px;margin-top:6px;justify-content:flex-end;'
    const saveBtn = document.createElement('button')
    saveBtn.textContent = '保存'
    saveBtn.style.cssText = 'border:1px solid var(--accent);background:var(--accent);color:#fff;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:12px;'
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText = 'border:1px solid var(--bd);background:transparent;color:var(--muted);padding:4px 10px;border-radius:5px;cursor:pointer;font-size:12px;'
    toolbar.appendChild(cancelBtn)
    toolbar.appendChild(saveBtn)
    overlay.appendChild(toolbar)
    document.body.appendChild(overlay)
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)

    const cleanup = () => { if (overlay.parentNode) overlay.remove() }
    const submit = () => {
      const newVal = input.value
      if (newVal !== currentValue) {
        const view = this.editor.getView()
        if (view.state.doc.nodeAt(pos)?.type.name === 'comment') {
          view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { kind, value: newVal }))
          view.focus()
          this.refreshPanels()
        }
      }
      cleanup()
    }
    saveBtn.addEventListener('click', submit)
    cancelBtn.addEventListener('click', cleanup)
    input.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
      if (e.key === 'Escape') cleanup()
    })
    const onClickAway = (e: MouseEvent) => {
      if (!overlay.contains(e.target as Node)) { cleanup(); document.removeEventListener('mousedown', onClickAway, true) }
    }
    setTimeout(() => document.addEventListener('mousedown', onClickAway, true), 0)
  }

  // --- comment actions from nav ---

  private startCommentEdit(i: number): void {
    this.editingCommentKey = i
    this.commentsNav.setEditing(i)
    this.refreshPanels()
  }

  private cancelCommentEdit(): void {
    this.editingCommentKey = null
    this.commentsNav.setEditing(null)
    this.refreshPanels()
  }

  private submitCommentEdit(i: number, newValue: string): void {
    this.editingCommentKey = null
    this.commentsNav.setEditing(null)
    const ref = this.comments[i]
    if (!ref) return
    if (this.active?.mode === 'wysiwyg' && ref.pos != null) {
      this.updateCommentAtPos(ref.pos, ref.kind, newValue)
    } else if (ref.index != null) {
      this.replaceCommentInCode(ref.index, ref.kind, ref.value, newValue)
    }
    this.refreshPanels()
  }

  private replyComment(i: number): void {
    const ref = this.comments[i]
    if (!ref) return
    const now = new Date()
    const d = String(now.getDate()).padStart(2, '0')
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const y = now.getFullYear()
    const stamp = `Reply@${d}-${m}-${y}：`
    const cur = ref.value.trimEnd()
    const newValue = cur.includes('Reply@') ? `${cur}\n${stamp}` : `${cur}${cur ? '\n' : ''}${stamp}`
    if (this.active?.mode === 'wysiwyg' && ref.pos != null) {
      this.updateCommentAtPos(ref.pos, ref.kind, newValue)
    } else if (ref.index != null) {
      this.replaceCommentInCode(ref.index, ref.kind, ref.value, newValue)
    }
    this.editingCommentKey = i
    this.commentsNav.setEditing(i)
    this.refreshPanels()
    this.scheduleAutoSave()
  }

  private deleteComment(i: number): void {
    const ref = this.comments[i]
    if (!ref) return
    if (!confirmDialog('确定删除此注释吗？（注释内容和框都会删除）')) return
    if (this.active?.mode === 'wysiwyg' && ref.pos != null) {
      const view = this.editor.getView()
      const node = view.state.doc.nodeAt(ref.pos)
      if (node && node.type.name === 'comment') {
        const tr = view.state.tr
        // If comment is the only child of a paragraph, remove the paragraph too
        const parent = view.state.doc.resolve(ref.pos).parent
        if (parent.type.name === 'paragraph' && parent.childCount === 1 && node.nodeSize === parent.content.size) {
          tr.delete(ref.pos - 1, ref.pos + node.nodeSize + 1)
        } else {
          tr.delete(ref.pos, ref.pos + node.nodeSize)
        }
        view.dispatch(tr.scrollIntoView())
        view.focus()
      }
    } else if (ref.index != null) {
      const old = rawComment(ref.kind, ref.value)
      const text = this.code.getValue()
      const idx = text.indexOf(old, ref.index)
      if (idx !== -1) {
        // Remove surrounding newline if block comment
        let start = idx
        let end = idx + old.length
        if (start >= 2 && text[start-1] === '\n' && text[start-2] === '\n') { start -= 2 }
        else if (start >= 1 && text[start-1] === '\n') { start -= 1 }
        if (end < text.length && text[end] === '\n' && text[end+1] === '\n') { end += 2 }
        else if (end < text.length && text[end] === '\n') { end += 1 }
        const newText = text.slice(0, start) + text.slice(end)
        this.suppress = true
        this.code.view.dispatch({
          changes: { from: start, to: end, insert: '' },
        })
        this.suppress = false
        this.onEditorChange(this.code.getValue())
      }
    }
    this.refreshPanels()
  }

  private uncommentComment(i: number): void {
    const ref = this.comments[i]
    if (!ref) return
    if (!confirmDialog('确定取消此注释吗？（框会移除，内容保留为普通文本）')) return
    const inner = ref.value.trim()
    if (this.active?.mode === 'wysiwyg' && ref.pos != null) {
      const view = this.editor.getView()
      const node = view.state.doc.nodeAt(ref.pos)
      if (node && node.type.name === 'comment') {
        const tr = view.state.tr
        if (inner) {
          const textNode = view.state.schema.text(inner)
          tr.replaceWith(ref.pos, ref.pos + node.nodeSize, textNode)
        } else {
          tr.delete(ref.pos, ref.pos + node.nodeSize)
        }
        view.dispatch(tr.scrollIntoView())
        view.focus()
      }
    } else if (ref.index != null) {
      const old = rawComment(ref.kind, ref.value)
      const text = this.code.getValue()
      const idx = text.indexOf(old, ref.index)
      if (idx !== -1) {
        const insert = inner ? ` ${inner} ` : ''
        const newText = text.slice(0, idx) + insert + text.slice(idx + old.length)
        this.suppress = true
        this.code.setValue(newText)
        this.suppress = false
        this.onEditorChange(newText)
      }
    }
    this.refreshPanels()
  }

  private updateCommentAtPos(pos: number, kind: CommentKind, newValue: string): void {
    const view = this.editor.getView()
    const node = view.state.doc.nodeAt(pos)
    if (node && node.type.name === 'comment') {
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { kind, value: newValue }))
      view.focus()
    }
  }

  private replaceCommentInCode(index: number, kind: CommentKind, oldValue: string, newValue: string): void {
    const text = this.code.getValue()
    const old = rawComment(kind, oldValue)
    const idx = text.indexOf(old, Math.max(0, index - oldValue.length - 10))
    if (idx !== -1) {
      const replacement = rawComment(kind, newValue)
      const newText = text.slice(0, idx) + replacement + text.slice(idx + old.length)
      this.suppress = true
      this.code.setValue(newText)
      this.suppress = false
      this.onEditorChange(this.code.getValue())
    }
  }

  private async execPastePlain(): Promise<void> {
    const target = this.capturePasteTarget()
    closeMenu()
    if (!target) {
      toast('没有可粘贴的文档', 'error')
      return
    }
    if (!navigator.clipboard?.readText) {
      toast('当前环境不支持直接读取剪贴板，请使用 Chrome 或 Edge', 'error', 2600)
      this.refocusPasteTarget(target)
      return
    }

    try {
      const state = await this.refreshClipboardReadPermission()
      if (state === 'denied') {
        toast('剪贴板权限已被拒绝，请在浏览器站点设置中允许', 'error', 3600)
        this.refocusPasteTarget(target)
        return
      }
      if (state === 'prompt') {
        toast('首次使用请在浏览器权限提示中点击允许', 'info', 2600)
      }
      const text = await navigator.clipboard.readText()
      this.clipboardReadState = 'granted'
      if (!text) {
        toast('剪贴板为空', 'info', 1400)
        this.refocusPasteTarget(target)
        return
      }
      this.insertPlainTextAt(target, text)
      toast('已粘贴纯文本', 'success', 1000)
    } catch {
      await this.refreshClipboardReadPermission()
      this.refocusPasteTarget(target)
      toast('浏览器未允许读取剪贴板，请允许后重试', 'error', 2600)
    }
  }

  private async refreshClipboardReadPermission(): Promise<PermissionState | 'unsupported' | null> {
    if (!navigator.clipboard?.readText || !navigator.permissions?.query) {
      this.clipboardReadState = 'unsupported'
      return this.clipboardReadState
    }
    try {
      const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
      this.clipboardReadState = status.state
      status.onchange = () => {
        this.clipboardReadState = status.state
      }
      return status.state
    } catch {
      this.clipboardReadState = null
      return null
    }
  }

  private capturePasteTarget(): PasteTargetSnapshot | null {
    const doc = this.active
    if (!doc) return null
    if (doc.mode === 'wysiwyg') {
      const { from, to } = this.editor.getView().state.selection
      return { docId: doc.id, mode: doc.mode, from, to }
    }
    const { from, to } = this.code.view.state.selection.main
    return { docId: doc.id, mode: doc.mode, from, to }
  }

  private insertPlainTextAt(target: PasteTargetSnapshot, text: string): void {
    if (this.activeId !== target.docId || this.active?.mode !== target.mode) return
    if (target.mode === 'wysiwyg') {
      this.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const max = view.state.doc.content.size
        const from = Math.max(0, Math.min(target.from, max))
        const to = Math.max(from, Math.min(target.to, max))
        view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView())
        view.focus()
      })
    } else {
      const max = this.code.view.state.doc.length
      const from = Math.max(0, Math.min(target.from, max))
      const to = Math.max(from, Math.min(target.to, max))
      this.code.view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      })
      this.code.focus()
    }
  }

  private refocusPasteTarget(target: PasteTargetSnapshot): void {
    if (this.activeId !== target.docId || this.active?.mode !== target.mode) return
    if (target.mode === 'wysiwyg') this.editor.focus()
    else this.code.focus()
  }

  private async openSingleFile(): Promise<void> {
    if (!fsSupported()) {
      toast('浏览器不支持文件选择', 'error')
      return
    }
    const w = window as unknown as {
      showOpenFilePicker?: (o: unknown) => Promise<FileSystemFileHandle[]>
    }
    if (!w.showOpenFilePicker) {
      toast('浏览器不支持打开文件', 'error')
      return
    }
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] } }],
        multiple: false,
      })
      const content = await readFile(handle)
      const doc = createDoc({
        name: handle.name,
        content,
        savedContent: content,
        fileHandle: handle,
        parentDir: null,
        path: handle.name,
      })
      this.docs.push(doc)
      this.setActive(doc.id)
      this.renderTabs()
      toast(`已打开：${handle.name}`, 'success', 1500)
    } catch {
      /* user cancelled */
    }
  }

  private async createEntry(dir: FileSystemDirectoryHandle, kind: 'file' | 'dir'): Promise<void> {
    const def = kind === 'file' ? '未命名.md' : '新建文件夹'
    const name = promptDialog(`${kind === 'file' ? '文档' : '文件夹'}名称：`, def)
    if (!name) return
    try {
      if (kind === 'file') await createFile(dir, name.endsWith('.md') ? name : `${name}.md`)
      else await dir.getDirectoryHandle(name, { create: true })
      await this.fileTree.refresh()
      toast('已创建', 'success', 1200)
    } catch (e) {
      toast(`创建失败：${(e as Error).message}`, 'error')
    }
  }

  private async renameEntry(node: TreeNode): Promise<void> {
    const name = promptDialog('新名称：', node.name)
    if (!name || name === node.name) return
    try {
      await renameFile(node.parent, node.name, name.endsWith('.md') ? name : `${name}.md`)
      await this.fileTree.refresh()
      const doc = this.docs.find((d) => d.path === node.path)
      if (doc) {
        doc.name = name
        doc.path = null
        doc.fileHandle = null
        this.renderTabs()
      }
      toast('已重命名', 'success', 1200)
    } catch (e) {
      toast(`重命名失败：${(e as Error).message}`, 'error')
    }
  }

  private async deleteEntry(node: TreeNode): Promise<void> {
    if (!confirmDialog(`确定删除「${node.name}」吗？`)) return
    try {
      await removeEntry(node.parent, node.name, node.kind === 'directory')
      await this.fileTree.refresh()
      const idx = this.docs.findIndex((d) => d.path === node.path)
      if (idx >= 0) this.closeDoc(this.docs[idx].id)
      toast('已删除', 'success', 1200)
    } catch (e) {
      toast(`删除失败：${(e as Error).message}`, 'error')
    }
  }

  // --- export / theme ---

  private async doExportHTML(): Promise<void> {
    const doc = this.active
    if (!doc) return
    if (doc.mode === 'code') {
      this.suppress = true
      this.editor.setMarkdown(this.code.getValue())
      this.suppress = false
    }
    const content = this.editor.getHTML()
    const dark = this.settings.exportUseTheme && document.documentElement.classList.contains('dark')
    const nav = this.settings.exportKeepNav ? this.headings.map((h) => ({ text: h.text, level: h.level })) : undefined
    await exportHTML(doc.name.replace(/\.md$/, ''), content, { dark, nav })
  }

  private doExportPDF(): void {
    // If not applying current theme, print in light mode then restore.
    const wasDark = document.documentElement.classList.contains('dark')
    if (wasDark && !this.settings.exportUseTheme) {
      document.documentElement.classList.remove('dark')
      setTimeout(() => {
        exportPDF()
        document.documentElement.classList.add('dark')
      }, 60)
    } else {
      exportPDF()
    }
  }

  private toggleTheme(): void {
    document.documentElement.classList.toggle('dark')
  }

  // --- recent ---

  private async tryRestoreRecent(): Promise<void> {
    try {
      const last = await getLastDir()
      if (!last) return
      const granted = await ensurePermission(last, 'readwrite').catch(() => false)
      if (granted) await this.mountDir(last)
    } catch {
      /* ignore */
    }
  }

  // --- keyboard / unload ---

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && e.shiftKey && k === 's') {
        e.preventDefault()
        this.saveAsActive()
      } else if (mod && k === 's') {
        e.preventDefault()
        this.saveActive()
      } else if (mod && k === '/') {
        e.preventDefault()
        this.toggleMode()
      } else if (mod && k === 'f') {
        e.preventDefault()
        this.openFind()
      } else if (mod && k === 'u') {
        e.preventDefault()
        this.execUnderline()
      } else if (mod && k === 'k') {
        e.preventDefault()
        this.execLink()
      } else if (e.key === 'Escape' && this.findReplace.isOpen()) {
        this.findReplace.close()
      }
    })
  }

  private setupContextMenu(): void {
    document.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement
      if (this.fileTree.contains(target)) {
        e.preventDefault()
        this.showFileContext(this.fileTree.nodeFromElement(target), e.clientX, e.clientY)
      } else if (target.closest('.editor-area')) {
        e.preventDefault()
        this.showEditorContext(e.clientX, e.clientY)
      } else {
        e.preventDefault()
        closeMenu()
      }
    })
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', (e) => {
      if (this.docs.some((d) => isDirty(d))) {
        e.preventDefault()
        e.returnValue = ''
      }
    })
  }
}

const app = new App()
app.init(document.querySelector<HTMLDivElement>('#app')!)
;(window as unknown as { __recent: () => Promise<RecentEntry[]> }).__recent = getRecent
