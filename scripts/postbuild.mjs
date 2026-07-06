// Post-build: copy the self-contained bundle to a friendly, ready-to-share
// launcher file at the project root: "MD Editor.html".
import { copyFileSync, existsSync, statSync } from 'node:fs'

const src = 'dist/index.html'
const out = 'MD Editor.html'

if (!existsSync(src)) {
  console.error('✗ 未找到 dist/index.html，请先执行 vite build')
  process.exit(1)
}

copyFileSync(src, out)

const kb = (statSync(out).size / 1024).toFixed(0)
console.log(`\n✓ 启动器已生成：${out}  (${kb} KB)`)
console.log('  这就是要发给用户的成品，用 Chrome / Edge 打开即可（无需其它文件）。\n')
