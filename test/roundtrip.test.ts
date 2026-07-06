// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { getMarkdown } from '@milkdown/kit/utils'
import { editorViewCtx } from '@milkdown/kit/core'
import { commentPlugins } from '../src/comments/node-comment'

async function makeEditor(md: string) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, md)
    })
    .use(commonmark)
    .use(gfm)
    .use(commentPlugins)
    .create()
  return editor
}

function roundtrip(editor: Editor): string {
  return editor.action(getMarkdown())
}

function countCommentNodes(editor: Editor): { html: number; tmpl: number } {
  let html = 0
  let tmpl = 0
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.state.doc.descendants((node) => {
      if (node.type.name === 'comment') {
        if (node.attrs.kind === 'tmpl') tmpl++
        else html++
      }
      return true
    })
  })
  return { html, tmpl }
}

describe('milkdown comment integration', () => {
  beforeAll(() => {
    // ProseMirror needs a couple of DOM APIs jsdom lacks
    if (!(document as any).createRange) {
      // noop
    }
  })

  it('parses an inline html comment into a comment node', async () => {
    const editor = await makeEditor('text <!-- hi --> end')
    expect(countCommentNodes(editor).html).toBe(1)
  })

  it('parses a template comment into a comment node', async () => {
    const editor = await makeEditor('a <%-- todo --%> b')
    expect(countCommentNodes(editor).tmpl).toBe(1)
  })

  it('round-trips an inline html comment losslessly', async () => {
    const editor = await makeEditor('text <!-- hi --> end')
    expect(roundtrip(editor).trim()).toContain('<!-- hi -->')
  })

  it('round-trips a template comment losslessly', async () => {
    const editor = await makeEditor('a <%-- todo --%> b')
    expect(roundtrip(editor).trim()).toContain('<%-- todo --%>')
  })

  it('round-trips a block-level html comment', async () => {
    const editor = await makeEditor('para\n\n<!-- block -->\n\nmore')
    const out = roundtrip(editor)
    expect(out).toContain('<!-- block -->')
  })

  it('preserves both kinds together', async () => {
    const editor = await makeEditor('<%-- one --%>\n\nmid <!-- two -->')
    const c = countCommentNodes(editor)
    expect(c.tmpl).toBe(1)
    expect(c.html).toBe(1)
  })
})
