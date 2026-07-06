# Contributing / 贡献指南

**English** | [中文](#中文)

Thanks for your interest in improving MD Editor!

## Development setup

```bash
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # produces "MD-Editor.html" at the project root
npm test         # run unit tests (Vitest)
npx tsc --noEmit # type check
```

## Project layout

- `src/main.ts` — app controller (menus, events, state)
- `src/editor/` — Milkdown (WYSIWYG) + CodeMirror (source) wrappers
- `src/comments/` — comment node, parser, collector (the signature feature)
- `src/app/` — menus, search, settings, help, i18n, table toolbar, modals
- `src/commands/` — export, images
- `src/fs/` — File System Access helpers
- `src/panels/` — file tree, outline, comment navigation
- `src/tabs/` — multi-tab document model
- `src/styles/` — CSS (theme tokens + components)
- `test/` — unit tests

## Before opening a PR

1. `npx tsc --noEmit` passes (no type errors).
2. `npm test` passes.
3. `npm run build` succeeds.
4. Keep changes focused; match the existing code style (TypeScript, no framework).
5. Do not commit build artifacts (`dist/`, `MD-Editor.html`) — they are git-ignored and shipped via GitHub Releases.

## Notes

- Target browsers are **Chrome / Edge** (File System Access API).
- The app must remain a single self-contained offline HTML after build (no runtime CDN/network dependencies).

---

## 中文

感谢你有兴趣改进 MD Editor！

### 开发环境

```bash
npm install
npm run dev      # 本地预览 http://localhost:5173
npm run build    # 在项目根目录生成 “MD-Editor.html”
npm test         # 运行单元测试（Vitest）
npx tsc --noEmit # 类型检查
```

### 目录结构

- `src/main.ts` — 应用控制器（菜单、事件、状态）
- `src/editor/` — Milkdown（所见即所得）+ CodeMirror（源码）封装
- `src/comments/` — 注释节点、解析、收集（核心特色）
- `src/app/` — 菜单、查找、设置、帮助、i18n、表格工具栏、模态框
- `src/commands/` — 导出、图片
- `src/fs/` — File System Access 封装
- `src/panels/` — 文件树、大纲、注释导航
- `src/tabs/` — 多标签文档模型
- `src/styles/` — CSS（主题 token + 组件）
- `test/` — 单元测试

### 提 PR 前请确认

1. `npx tsc --noEmit` 通过（无类型错误）
2. `npm test` 通过
3. `npm run build` 成功
4. 改动聚焦、沿用现有代码风格（TypeScript、无框架）
5. 不要提交构建产物（`dist/`、`MD-Editor.html`）——它们已被 gitignore，通过 GitHub Releases 分发

### 说明

- 目标浏览器为 **Chrome / Edge**（File System Access API）
- 构建后必须保持为单个自包含的离线 HTML（运行时不依赖 CDN/网络）
