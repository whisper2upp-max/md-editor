# MD Editor

**English** | [中文](#中文说明)

A **WYSIWYG** Markdown editor with instant preview and one-click switch to source mode. Its signature feature is **comment navigation**. The whole app is bundled into a **single self-contained HTML file** — double-click to run in a browser, no install and no internet required.

> Author: Wesley Yan · License: MIT

## Features

- **Two editing modes** — inline WYSIWYG and raw Markdown source, switch anytime.
- **Comment navigation (the signature feature)**
  - `<!-- -->` visible comments and `<%-- --%>` hidden comments, grouped and color-coded in the panel.
  - From the left **Comments** panel you can **jump, edit, reply, delete, and un-comment** — every action is reflected in the document instantly.
- **Left sidebar** — file tree, outline, and comment navigation (toggleable).
- **Top menu bar** — File / Edit / Paragraph / Format / View.
- **Rich syntax** — headings, lists, task lists, tables (with a floating edit toolbar), code highlighting, math (KaTeX), Mermaid diagrams, callouts, YAML front matter.
- **Local files** — open file / folder, multiple tabs, drag-and-drop, images saved to `assets/`.
- **Find & Replace** (`Ctrl/⌘ + F`) — keyword search + locate, replace one, replace all.
- **Export** — HTML (with Mermaid rendered) and PDF (browser print).
- **Settings** — auto-save on tab switch, drag-drop behavior, English/Chinese UI, image path preferences, export options.
- **Theme** — light / dark.

## Keyboard Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/⌘ + S` | Save |
| `Ctrl/⌘ + Shift + S` | Save As |
| `Ctrl/⌘ + N` | New tab |
| `Ctrl/⌘ + /` | Toggle source / preview |
| `Ctrl/⌘ + F` | Find & Replace |
| `Ctrl/⌘ + B` / `I` / `U` / `K` | Bold / Italic / Underline / Link |
| Double-click a comment | Edit it in place |
| Right-click | Open the editing context menu |

## Which file is the launcher?

| File | What it is | Distribute? |
| --- | --- | --- |
| **`MD Editor.html`** (project root) | The **finished, self-contained launcher** (created by `npm run build`). | ✅ **Send this one file** |
| `index.html` (project root) | The **dev entry** (loads `/src/main.ts`, needs `npm run dev`). Double-clicking it shows a guidance page. | ❌ Never |
| `dist/index.html` | Raw Vite build output (same content as `MD Editor.html`). | Optional |

## Getting Started (development)

```bash
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # produces "MD Editor.html" at the project root
npm test         # run unit tests
```

## Distribute to users

1. Run `npm run build` → it generates **`MD Editor.html`** at the project root.
2. Send that **single file** to users. They open it with **Chrome or Edge** — no install, no internet.
3. For public download, attach `MD Editor.html` to a **GitHub Release** (recommended over committing the binary).

### Browser compatibility
- Full features (open folder / file, save to disk) rely on the **File System Access API** → use **Chrome / Edge**.
- Safari / Firefox have limited support and fall back gracefully (read-only / download-to-save).

## Tech Stack

Vite + vite-plugin-singlefile · [Milkdown](https://milkdown.dev) (ProseMirror) · [CodeMirror 6](https://codemirror.net) · [Mermaid](https://mermaid.js.org) · [KaTeX](https://katex.org) · idb-keyval.

## License & Acknowledgements

Released under the **MIT License** (see [LICENSE](./LICENSE)). All bundled third-party libraries are **MIT** licensed: Milkdown, CodeMirror, Mermaid, KaTeX, idb-keyval, Vite, vite-plugin-singlefile. Thanks to their authors and communities.

## Disclaimer

This is an **independent open-source project** and is **not affiliated with, endorsed by, or connected to** Typora, Ulysses, Obsidian, or any other Markdown editor. Any third-party product names are used descriptively only; trademarks belong to their respective owners. The software is provided "as is", without warranty of any kind.

---

## 中文说明

**中文** | [English](#md-editor)

一个**所见即所得（WYSIWYG）**的 Markdown 编辑器，支持即时预览与源码模式一键切换，核心特色是**注释导航**。整个应用被打包成**单个自包含的 HTML 文件**，双击即可在浏览器中运行，无需安装、无需联网。

> 作者：Wesley Yan · 许可证：MIT

### 功能特性

- **两种编辑模式** —— 内联所见即所得（WYSIWYG）与纯 Markdown 源码，一键切换。
- **注释导航（核心特色）**
  - `<!-- -->` 显性注释、`<%-- --%>` 隐形注释，在导航栏分组、颜色区分。
  - 左侧「注释」栏可对每条注释**定位跳转、编辑、回复、删除、取消注释**，所有操作实时反映到文档。
- **左侧三栏** —— 文件树、大纲、注释导航（可显隐）。
- **上菜单栏** —— 文件 / 编辑 / 段落 / 格式 / 显示。
- **富语法** —— 标题、列表、任务列表、表格（含浮动编辑工具栏）、代码高亮、数学公式（KaTeX）、Mermaid 图表、提示框、YAML Front Matter。
- **本地文件** —— 打开文件 / 文件夹、多标签页、拖拽打开、图片保存到 `assets/`。
- **查找替换**（`Ctrl/⌘ + F`）—— 关键字搜索定位、单个替换、全文替换。
- **导出** —— HTML（含 Mermaid 渲染）与 PDF（浏览器打印）。
- **设置** —— 切换标签自动保存、拖入行为、中英文界面、图片语法偏好、导出选项。
- **主题** —— 亮 / 暗色。

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + S` | 保存 |
| `Ctrl/⌘ + Shift + S` | 另存为 |
| `Ctrl/⌘ + N` | 新建标签页 |
| `Ctrl/⌘ + /` | 切换源码 / 预览 |
| `Ctrl/⌘ + F` | 查找与替换 |
| `Ctrl/⌘ + B` / `I` / `U` / `K` | 加粗 / 斜体 / 下划线 / 超链接 |
| 双击注释 | 就地编辑该注释 |
| 右键 | 呼出编辑上下文菜单 |

### 哪个文件才是启动器？

| 文件 | 说明 | 是否分发 |
| --- | --- | --- |
| **`MD Editor.html`**（项目根目录） | **打包好的自包含启动器**（由 `npm run build` 生成）。 | ✅ **就发这一个文件** |
| `index.html`（项目根目录） | **开发入口**（引用 `/src/main.ts`，需 `npm run dev`）。直接双击会显示一个引导提示页。 | ❌ 不要发 |
| `dist/index.html` | Vite 原始构建产物（内容与 `MD Editor.html` 相同）。 | 可选 |

### 快速开始（开发）

```bash
npm install
npm run dev      # 本地预览 http://localhost:5173
npm run build    # 在项目根目录生成 “MD Editor.html”
npm test         # 运行单元测试
```

### 发布给用户

1. 执行 `npm run build` → 在项目根目录生成 **`MD Editor.html`**。
2. 把这**一个文件**发给用户，用户用 **Chrome 或 Edge** 打开即可，无需安装或联网。
3. 若要公开供人下载，建议把 `MD Editor.html` 作为附件放到 **GitHub Release**（比把成品文件提交进仓库更规范）。

#### 浏览器兼容
- 完整功能（打开文件夹 / 文件、保存到本地）依赖 **File System Access API** → 需 **Chrome / Edge**。
- Safari / Firefox 支持有限，会自动降级（只读 / 下载另存）。

### 技术栈

Vite + vite-plugin-singlefile · [Milkdown](https://milkdown.dev)（ProseMirror）· [CodeMirror 6](https://codemirror.net) · [Mermaid](https://mermaid.js.org) · [KaTeX](https://katex.org) · idb-keyval。

### 开源许可与致谢

本项目以 **MIT License** 发布（见 [LICENSE](./LICENSE)）。所依赖的第三方开源库均为 **MIT** 许可：Milkdown、CodeMirror、Mermaid、KaTeX、idb-keyval、Vite、vite-plugin-singlefile。感谢以上项目的作者与社区。

### 免责声明

本项目为**独立的开源作品**，与 Typora、Ulysses、Obsidian 或任何其他 Markdown 编辑器**均无任何关联、合作或授权关系**。项目中出现的任何第三方产品名称仅用于描述性说明，其商标归各自所有者所有。本软件按「原样」提供，不对适用性或使用后果作任何担保。
