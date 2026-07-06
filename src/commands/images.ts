import { getOrCreateSubdir, writeBytes } from '../fs/access'
import { toast } from '../app/toast'

/**
 * Thrown when an image can't be persisted because no folder is open.
 * Callers (and Crepe's upload feature) treat this as a failed upload, so no
 * temporary `blob:` URL ever gets written into the saved Markdown.
 */
export class NoImageDirError extends Error {
  constructor() {
    super('no image directory')
    this.name = 'NoImageDirError'
  }
}

/**
 * Manages images for the current document folder.
 * - `onUpload` saves a pasted/dropped image into `assets/` and returns the
 *   relative path stored in the markdown.
 * - `proxyDomURL` resolves relative asset paths to blob URLs for display.
 */
export class ImageManager {
  private dir: FileSystemDirectoryHandle | null = null
  private cache = new Map<string, string>()
  private addDotSlash = false

  setDir(dir: FileSystemDirectoryHandle | null): void {
    this.dir = dir
    for (const url of this.cache.values()) URL.revokeObjectURL(url)
    this.cache.clear()
  }

  setPrefs(prefs: { addDotSlash?: boolean }): void {
    if (prefs.addDotSlash !== undefined) this.addDotSlash = prefs.addDotSlash
  }

  hasDir(): boolean {
    return this.dir !== null
  }

  private extOf(file: File): string {
    const fromName = file.name.includes('.') ? file.name.split('.').pop()! : ''
    if (fromName) return fromName.toLowerCase()
    return (file.type.split('/')[1] || 'png').toLowerCase()
  }

  onUpload = async (file: File): Promise<string> => {
    if (!this.dir) {
      // Never write a session-only blob: URL into the document — it would be
      // lost on reload. Refuse the upload and tell the user to open a folder.
      toast('请先「打开文件夹」，图片才能保存到本地', 'error', 3000)
      throw new NoImageDirError()
    }
    const assets = await getOrCreateSubdir(this.dir, 'assets')
    const name = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${this.extOf(file)}`
    const handle = await assets.getFileHandle(name, { create: true })
    await writeBytes(handle, await file.arrayBuffer())
    return `${this.addDotSlash ? './' : ''}assets/${name}`
  }

  proxyDomURL = async (url: string): Promise<string> => {
    if (/^(https?:|blob:|data:)/.test(url)) return url
    if (!this.dir) return url
    if (this.cache.has(url)) return this.cache.get(url)!
    try {
      const parts = url.replace(/^\.?\//, '').split('/')
      let dir: FileSystemDirectoryHandle = this.dir
      for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i])
      const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
      const blob = URL.createObjectURL(await fileHandle.getFile())
      this.cache.set(url, blob)
      return blob
    } catch {
      return url
    }
  }
}
