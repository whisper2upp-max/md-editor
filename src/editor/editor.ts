import { Crepe } from '@milkdown/crepe'
import { editorViewCtx, commandsCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { replaceAll, getHTML, insert } from '@milkdown/kit/utils'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  wrapInHeadingCommand,
  turnIntoTextCommand,
  createCodeBlockCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { undo, redo } from '@milkdown/kit/prose/history'
import {
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
  deleteRow,
  deleteColumn,
} from '@milkdown/kit/prose/tables'
import type { Command } from '@milkdown/kit/prose/state'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { Ctx } from '@milkdown/kit/ctx'
import type { EditorView } from '@milkdown/kit/prose/view'
import { commentPlugins, type CommentKind } from '../comments/node-comment'

export interface ImageConfig {
  onUpload: (file: File) => Promise<string>
  proxyDomURL: (url: string) => Promise<string> | string
}

export type TableOp = 'rowBefore' | 'rowAfter' | 'colBefore' | 'colAfter' | 'delRow' | 'delCol'

export interface EditorHandle {
  crepe: Crepe
  getMarkdown: () => string
  setMarkdown: (md: string) => void
  getHTML: () => string
  action: <T>(fn: (ctx: Ctx) => T) => T
  getView: () => EditorView
  focus: () => void
  hasSelection: () => boolean
  getSelectedText: () => string
  toggleBold: () => void
  toggleItalic: () => void
  toggleInlineCode: () => void
  toggleStrike: () => void
  toggleLink: () => void
  toggleUnderline: () => void
  setHeading: (level: number) => void
  setParagraph: () => void
  createCodeBlock: () => void
  bulletList: () => void
  orderedList: () => void
  wrapComment: (kind: CommentKind) => void
  insertComment: (kind: CommentKind) => void
  insertMarkdown: (md: string, inline?: boolean) => void
  insertMarkdownAt: (from: number, to: number, md: string) => void
  caretAtCoords: (x: number, y: number) => void
  tableOp: (op: TableOp) => void
  undo: () => void
  redo: () => void
  copyPlainText: () => Promise<void>
  destroy: () => Promise<void>
}

export interface CreateEditorOptions {
  root: HTMLElement
  defaultValue?: string
  onChange?: (markdown: string) => void
  image?: ImageConfig
}

export async function createEditor(opts: CreateEditorOptions): Promise<EditorHandle> {
  const crepe = new Crepe({
    root: opts.root,
    defaultValue: opts.defaultValue ?? '',
    featureConfigs: opts.image
      ? {
          'image-block': {
            onUpload: opts.image.onUpload,
            blockOnUpload: opts.image.onUpload,
            inlineOnUpload: opts.image.onUpload,
            proxyDomURL: opts.image.proxyDomURL,
          },
        }
      : undefined,
  })

  crepe.editor.use(listener).use(commentPlugins)

  crepe.editor.config((ctx) => {
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
      if (markdown !== prevMarkdown) opts.onChange?.(markdown)
    })
  })

  await crepe.create()

  const action = <T,>(fn: (ctx: Ctx) => T): T => crepe.editor.action(fn) as T
  const run = (key: unknown, payload?: unknown) =>
    action((ctx) => ctx.get(commandsCtx).call(key as never, payload as never))

  const runProse = (cmd: Command) =>
    action((ctx) => {
      const view = ctx.get(editorViewCtx)
      cmd(view.state, view.dispatch, view)
      view.focus()
    })

  const getSelectedText = () =>
    action((ctx) => {
      const { state } = ctx.get(editorViewCtx)
      const { from, to } = state.selection
      return state.doc.textBetween(from, to, '\n', ' ')
    })

  const wrapComment = (kind: CommentKind) => {
    action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { from, to, empty } = state.selection
      const type = state.schema.nodes.comment
      if (!type) return
      const text = empty ? '' : state.doc.textBetween(from, to, ' ')
      const value = text ? ` ${text} ` : '  '
      view.dispatch(state.tr.replaceSelectionWith(type.create({ kind, value })).scrollIntoView())
      view.focus()
    })
  }

  const insertComment = (kind: CommentKind) => {
    action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const type = view.state.schema.nodes.comment
      if (!type) return
      view.dispatch(view.state.tr.insertText(' ').scrollIntoView())
      view.dispatch(view.state.tr.replaceSelectionWith(type.create({ kind, value: '' })).scrollIntoView())
      view.focus()
    })
  }

  const toggleUnderline = () => {
    const sel = getSelectedText()
    action((ctx) => {
      const view = ctx.get(editorViewCtx)
      insert(`<u>${sel}</u>`, true)(ctx)
      view.focus()
    })
  }

  const tableOp = (op: TableOp) => {
    const cmd: Command =
      op === 'rowBefore' ? addRowBefore
      : op === 'rowAfter' ? addRowAfter
      : op === 'colBefore' ? addColumnBefore
      : op === 'colAfter' ? addColumnAfter
      : op === 'delRow' ? deleteRow
      : deleteColumn
    runProse(cmd)
  }

  return {
    crepe,
    getMarkdown: () => crepe.getMarkdown(),
    setMarkdown: (md: string) => crepe.editor.action(replaceAll(md)),
    getHTML: () => action((ctx) => getHTML()(ctx)),
    action,
    getView: () => action((ctx) => ctx.get(editorViewCtx)),
    focus: () => action((ctx) => ctx.get(editorViewCtx).focus()),
    hasSelection: () => action((ctx) => !ctx.get(editorViewCtx).state.selection.empty),
    getSelectedText,
    toggleBold: () => run(toggleStrongCommand.key),
    toggleItalic: () => run(toggleEmphasisCommand.key),
    toggleInlineCode: () => run(toggleInlineCodeCommand.key),
    toggleStrike: () => run(toggleStrikethroughCommand.key),
    toggleLink: () => run(toggleLinkCommand.key),
    toggleUnderline,
    setHeading: (level: number) => run(wrapInHeadingCommand.key, level),
    setParagraph: () => run(turnIntoTextCommand.key),
    createCodeBlock: () => run(createCodeBlockCommand.key),
    bulletList: () => run(wrapInBulletListCommand.key),
    orderedList: () => run(wrapInOrderedListCommand.key),
    wrapComment,
    insertComment,
    insertMarkdown: (md: string, inline = false) => action((ctx) => insert(md, inline)(ctx)),
    insertMarkdownAt: (from: number, to: number, md: string) =>
      action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const size = view.state.doc.content.size
        const f = Math.max(0, Math.min(from, size))
        const t = Math.max(f, Math.min(to, size))
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, f, t)))
        insert(md, false)(ctx)
      }),
    caretAtCoords: (x: number, y: number) =>
      action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const hit = view.posAtCoords({ left: x, top: y })
        if (!hit) return
        const pos = hit.pos
        const sel = view.state.selection
        // Preserve an existing non-empty selection if the click is inside it.
        if (!sel.empty && pos >= sel.from && pos <= sel.to) return
        try {
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
          view.focus()
        } catch {
          /* pos not selectable */
        }
      }),
    tableOp,
    undo: () => runProse(undo),
    redo: () => runProse(redo),
    copyPlainText: async () => {
      const text = getSelectedText()
      if (text) await navigator.clipboard.writeText(text)
    },
    destroy: () => crepe.destroy().then(() => undefined),
  }
}
