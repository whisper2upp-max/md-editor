import { readDir, type TreeNode } from '../fs/tree'

export interface FileTreeCallbacks {
  onOpenFile: (node: TreeNode) => void
}

export class FileTreePanel {
  private el: HTMLElement
  private root: FileSystemDirectoryHandle | null = null
  private rootNodes: TreeNode[] = []
  private cb: FileTreeCallbacks
  private activePath: string | null = null

  constructor(el: HTMLElement, cb: FileTreeCallbacks) {
    this.el = el
    this.cb = cb
  }

  /** Resolve the tree node for a DOM element (used by the global context menu). */
  nodeFromElement(target: HTMLElement): TreeNode | null {
    const row = target.closest('[data-path]') as HTMLElement | null
    if (!row) return null
    return this.findNode(row.dataset.path!)
  }

  contains(target: Node): boolean {
    return this.el.contains(target)
  }

  async setRoot(handle: FileSystemDirectoryHandle): Promise<void> {
    this.root = handle
    this.rootNodes = await readDir(handle)
    this.render()
  }

  getRoot(): FileSystemDirectoryHandle | null {
    return this.root
  }

  setActive(path: string | null): void {
    this.activePath = path
    this.render()
  }

  async refresh(): Promise<void> {
    if (this.root) {
      const expanded = this.collectExpanded(this.rootNodes)
      this.rootNodes = await readDir(this.root)
      await this.restoreExpanded(this.rootNodes, expanded)
      this.render()
    }
  }

  private collectExpanded(nodes: TreeNode[], acc = new Set<string>()): Set<string> {
    for (const n of nodes) {
      if (n.kind === 'directory' && n.loaded && n.children) {
        acc.add(n.path)
        this.collectExpanded(n.children, acc)
      }
    }
    return acc
  }

  private async restoreExpanded(nodes: TreeNode[], expanded: Set<string>): Promise<void> {
    for (const n of nodes) {
      if (n.kind === 'directory' && expanded.has(n.path)) {
        n.children = await readDir(n.handle as FileSystemDirectoryHandle, n.path)
        n.loaded = true
        await this.restoreExpanded(n.children, expanded)
      }
    }
  }

  private findNode(path: string, nodes = this.rootNodes): TreeNode | null {
    for (const n of nodes) {
      if (n.path === path) return n
      if (n.children) {
        const found = this.findNode(path, n.children)
        if (found) return found
      }
    }
    return null
  }

  private async toggleDir(node: TreeNode): Promise<void> {
    if (!node.loaded) {
      node.children = await readDir(node.handle as FileSystemDirectoryHandle, node.path)
      node.loaded = true
    } else {
      node.loaded = false
      node.children = undefined
    }
    this.render()
  }

  private render(): void {
    if (!this.root) {
      this.el.innerHTML = `<div class="panel-empty">未打开文件夹</div>`
      return
    }
    const ul = document.createElement('ul')
    ul.className = 'tree'
    this.renderNodes(this.rootNodes, ul, 0)
    this.el.innerHTML = ''
    this.el.appendChild(ul)
  }

  private renderNodes(nodes: TreeNode[], parent: HTMLElement, depth: number): void {
    for (const node of nodes) {
      const li = document.createElement('li')
      const row = document.createElement('div')
      row.className = 'tree-row'
      row.dataset.path = node.path
      row.style.paddingLeft = `${8 + depth * 14}px`
      if (node.path === this.activePath) row.classList.add('active')

      if (node.kind === 'directory') {
        row.innerHTML = `<span class="tree-caret ${node.loaded ? 'open' : ''}">▸</span><span class="tree-icon">📁</span><span class="tree-name">${escapeHtml(node.name)}</span>`
        row.addEventListener('click', () => this.toggleDir(node))
      } else {
        row.innerHTML = `<span class="tree-caret"></span><span class="tree-icon">📄</span><span class="tree-name">${escapeHtml(node.name)}</span>`
        row.addEventListener('click', () => this.cb.onOpenFile(node))
      }
      li.appendChild(row)
      if (node.kind === 'directory' && node.loaded && node.children) {
        const childUl = document.createElement('ul')
        childUl.className = 'tree'
        this.renderNodes(node.children, childUl, depth + 1)
        li.appendChild(childUl)
      }
      parent.appendChild(li)
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
