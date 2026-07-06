import { get, set, del } from 'idb-keyval'

const LAST_DIR_KEY = 'md-editor:last-dir'
const RECENT_KEY = 'md-editor:recent'

export interface RecentEntry {
  name: string
  handle: FileSystemDirectoryHandle
  at: number
}

export async function saveLastDir(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(LAST_DIR_KEY, handle)
  const recent = await getRecent()
  const filtered = recent.filter((r) => r.name !== handle.name)
  filtered.unshift({ name: handle.name, handle, at: Date.now() })
  await set(RECENT_KEY, filtered.slice(0, 8))
}

export async function getLastDir(): Promise<FileSystemDirectoryHandle | undefined> {
  return get<FileSystemDirectoryHandle>(LAST_DIR_KEY)
}

export async function getRecent(): Promise<RecentEntry[]> {
  return (await get<RecentEntry[]>(RECENT_KEY)) ?? []
}

export async function clearRecent(): Promise<void> {
  await del(RECENT_KEY)
  await del(LAST_DIR_KEY)
}
