import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, statSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientDir = join(__dirname, 'dist', 'client')
const PORT = parseInt(process.env.PORT || '3000')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const appModule = await import('./dist/server/server.js')
const app = appModule.default
const handle = typeof app === 'function' ? app : app?.fetch?.bind(app)

if (!handle) throw new Error('No fetch handler found in dist/server/server.js')

createServer(async (req, res) => {
  // Serve static files from dist/client/
  const pathname = req.url.split('?')[0]
  const filePath = join(clientDir, pathname)

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath)
    const content = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    res.end(content)
    return
  }

  // Forward everything else to the TanStack Start SSR handler
  try {
    const host = req.headers.host || `localhost:${PORT}`
    const url = new URL(req.url, `http://${host}`)
    const headers = new Headers(
      Object.entries(req.headers).filter(([, v]) => v != null)
    )
    const webReq = new Request(url.toString(), {
      method: req.method,
      headers,
      ...(req.method !== 'GET' && req.method !== 'HEAD'
        ? { body: req, duplex: 'half' }
        : {}),
    })

    const webRes = await handle(webReq)
    const body = await webRes.arrayBuffer()

    res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()))
    res.end(Buffer.from(body))
  } catch (err) {
    console.error('SSR error:', err)
    res.writeHead(500)
    res.end('Internal Server Error')
  }
}).listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})
