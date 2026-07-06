export interface FsSupport {
  supported: boolean
}

export function fsSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const w = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>
  }
  if (!w.showDirectoryPicker) return null
  try {
    return await w.showDirectoryPicker({ mode: 'readwrite' })
  } catch {
    return null
  }
}

export async function ensurePermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const h = handle as unknown as {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>
    requestPermission?: (o: { mode: string }) => Promise<PermissionState>
  }
  if (!h.queryPermission) return true
  if ((await h.queryPermission({ mode })) === 'granted') return true
  if (h.requestPermission && (await h.requestPermission({ mode })) === 'granted') return true
  return false
}

export async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile()
  return await file.text()
}

export async function readFileBytes(handle: FileSystemFileHandle): Promise<Uint8Array> {
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

export async function writeFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  const w = await handle.createWritable()
  await w.write(content)
  await w.close()
}

export async function writeBytes(handle: FileSystemFileHandle, data: BlobPart): Promise<void> {
  const w = await handle.createWritable()
  await w.write(data)
  await w.close()
}

export async function getOrCreateSubdir(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return dir.getDirectoryHandle(name, { create: true })
}

export async function createFile(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemFileHandle> {
  return dir.getFileHandle(name, { create: true })
}

export async function removeEntry(
  dir: FileSystemDirectoryHandle,
  name: string,
  recursive = false
): Promise<void> {
  await dir.removeEntry(name, { recursive })
}

export async function renameFile(
  dir: FileSystemDirectoryHandle,
  oldName: string,
  newName: string
): Promise<FileSystemFileHandle> {
  const src = await dir.getFileHandle(oldName)
  const content = await readFile(src)
  const dest = await dir.getFileHandle(newName, { create: true })
  await writeFile(dest, content)
  await dir.removeEntry(oldName)
  return dest
}
