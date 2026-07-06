export interface TreeNode {
  name: string
  kind: 'file' | 'directory'
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
  parent: FileSystemDirectoryHandle
  path: string
  children?: TreeNode[]
  loaded?: boolean
}

const MD_EXT = /\.(md|markdown|mdown|mkd)$/i

async function entriesOf(
  dir: FileSystemDirectoryHandle
): Promise<[string, FileSystemHandle][]> {
  const out: [string, FileSystemHandle][] = []
  const anyDir = dir as unknown as {
    entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
  }
  for await (const entry of anyDir.entries()) out.push(entry)
  return out
}

export async function readDir(
  dir: FileSystemDirectoryHandle,
  basePath = ''
): Promise<TreeNode[]> {
  const entries = await entriesOf(dir)
  const nodes: TreeNode[] = []
  for (const [name, handle] of entries) {
    if (name.startsWith('.')) continue
    const path = basePath ? `${basePath}/${name}` : name
    if (handle.kind === 'directory') {
      nodes.push({
        name,
        kind: 'directory',
        handle: handle as FileSystemDirectoryHandle,
        parent: dir,
        path,
        loaded: false,
      })
    } else if (MD_EXT.test(name)) {
      nodes.push({
        name,
        kind: 'file',
        handle: handle as FileSystemFileHandle,
        parent: dir,
        path,
      })
    }
  }
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh')
  })
  return nodes
}
