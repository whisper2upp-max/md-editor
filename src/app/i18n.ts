export type Lang = 'zh' | 'en'

type Dict = Record<string, { zh: string; en: string }>

const DICT: Dict = {
  'menu.file': { zh: '文件', en: 'File' },
  'menu.edit': { zh: '编辑', en: 'Edit' },
  'menu.para': { zh: '段落', en: 'Paragraph' },
  'menu.format': { zh: '格式', en: 'Format' },
  'menu.view': { zh: '显示', en: 'View' },

  'panel.files': { zh: '文件树', en: 'Files' },
  'panel.outline': { zh: '大纲', en: 'Outline' },
  'panel.comments': { zh: '注释', en: 'Comments' },

  'toolbar.autosaveOn': { zh: '自动保存: 开', en: 'Auto-save: On' },
  'toolbar.autosaveOff': { zh: '自动保存: 关', en: 'Auto-save: Off' },
  'mode.toSource': { zh: '</> 源码模式', en: '</> Source' },
  'mode.toPreview': { zh: '👁 预览模式', en: '👁 Preview' },

  'file.openFile': { zh: '打开文件', en: 'Open File' },
  'file.openFolder': { zh: '打开文件夹', en: 'Open Folder' },
  'file.newTab': { zh: '新建标签页', en: 'New Tab' },
  'file.save': { zh: '保存', en: 'Save' },
  'file.saveAs': { zh: '另存为…', en: 'Save As…' },
  'file.exportHtml': { zh: '导出 HTML', en: 'Export HTML' },
  'file.exportPdf': { zh: '导出 PDF', en: 'Export PDF' },
  'file.settings': { zh: '设置', en: 'Settings' },
  'file.help': { zh: '帮助', en: 'Help' },
  'file.close': { zh: '关闭程序', en: 'Close App' },

  'edit.undo': { zh: '撤回', en: 'Undo' },
  'edit.redo': { zh: '重做', en: 'Redo' },
  'edit.cut': { zh: '剪切', en: 'Cut' },
  'edit.copy': { zh: '拷贝', en: 'Copy' },
  'edit.paste': { zh: '粘贴', en: 'Paste' },
  'edit.pasteImage': { zh: '粘贴图片', en: 'Paste Image' },
  'edit.pastePlain': { zh: '粘贴为纯文本', en: 'Paste as Plain Text' },
  'edit.copyPlain': { zh: '复制纯文本', en: 'Copy Plain Text' },
  'edit.copyMd': { zh: '复制为 Markdown 格式', en: 'Copy as Markdown' },
  'edit.copyHtml': { zh: '复制为 HTML 代码', en: 'Copy as HTML' },
  'edit.emoji': { zh: '表情与符号', en: 'Emoji & Symbols' },

  'para.heading': { zh: '标题', en: 'Heading' },
  'para.paragraph': { zh: '段落（正文）', en: 'Paragraph' },
  'para.table': { zh: '插入表格', en: 'Insert Table' },
  'para.tableEdit': { zh: '表格编辑', en: 'Edit Table' },
  'para.formula': { zh: '插入公式块', en: 'Insert Formula Block' },
  'para.admonition': { zh: '插入提示框', en: 'Insert Callout' },
  'para.hr': { zh: '插入分割线', en: 'Insert Divider' },
  'para.yaml': { zh: '插入 YAML Front Matter', en: 'Insert YAML Front Matter' },
  'para.list': { zh: '插入列表', en: 'Insert List' },
  'para.image': { zh: '插入图片', en: 'Insert Image' },

  'format.bold': { zh: '加粗', en: 'Bold' },
  'format.italic': { zh: '斜体', en: 'Italic' },
  'format.underline': { zh: '下划线', en: 'Underline' },
  'format.code': { zh: '代码', en: 'Code' },
  'format.strike': { zh: '删除线', en: 'Strikethrough' },
  'format.link': { zh: '超链接', en: 'Link' },
  'format.comment': { zh: '注释', en: 'Comment' },

  'view.toggleSidebar': { zh: '显示 / 隐藏侧边栏', en: 'Toggle Sidebar' },
  'view.toggleMode': { zh: '切换源码 / 预览', en: 'Toggle Source / Preview' },

  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.tab.file': { zh: '文件', en: 'File' },
  'settings.tab.general': { zh: '通用', en: 'General' },
  'settings.tab.image': { zh: '图片', en: 'Image' },
  'settings.tab.export': { zh: '导出', en: 'Export' },
  'settings.autoSaveOnSwitch': { zh: '切换标签页时自动保存', en: 'Auto-save when switching tabs' },
  'settings.dropBehavior': { zh: '拖入文件 / 文件夹时', en: 'When dropping files / folders' },
  'settings.dropOpen': { zh: '在程序内打开', en: 'Open in editor' },
  'settings.dropLink': { zh: '插入链接', en: 'Insert link' },
  'settings.language': { zh: '界面语言', en: 'Language' },
  'settings.version': { zh: '版本信息', en: 'Version' },
  'settings.changelog': { zh: '更新日志', en: 'Changelog' },
  'settings.imgPreferRelative': { zh: '优先使用相对路径', en: 'Prefer relative paths' },
  'settings.imgAddDotSlash': { zh: '为相对路径添加 ./', en: 'Prefix relative paths with ./' },
  'settings.imgAutoEscape': { zh: '插入时自动转义图片 URL', en: 'Auto-escape image URLs on insert' },
  'settings.exportKeepNav': { zh: '导出时保留侧边导航栏', en: 'Keep side navigation in export' },
  'settings.exportUseTheme': { zh: '导出时自动套用当前主题（深/浅色）', en: 'Apply current theme on export' },

  'help.title': { zh: '帮助', en: 'Help' },
}

let current: Lang = 'zh'

export function setLang(l: Lang): void {
  current = l
}
export function getLang(): Lang {
  return current
}
export function t(key: string): string {
  const e = DICT[key]
  if (!e) return key
  return e[current]
}
