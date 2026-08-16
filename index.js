// dsh-md-preview: DeepSeek Harness 插件（Host 半边）v0.7。
//
// 1. 监听 fs/observed，记录最近访问的 .md / .markdown 文件（最多 30 条），
//    每条含操作历史（读/写/改/删 + 时间，来自执行工具的 actor）与文件 mtime
//    （异步补记：recorder 必须同步返回）。每条记录同时关联访问它的会话 id，
//    列表按会话隔离：一个会话只看到自己读写/打开过的文件。
// 2. HTTP 端点（前端面板使用）：
//      GET /md-preview/api/recent?sessionId=…   最近 md 列表（按会话过滤；
//                                              每项含 path / time / rel / mtime / ops）
//      GET /md-preview/api/read?path=…&sessionId=…   读取单个 md 文本（≤2MB），
//                                              成功后把该文件记入「最近」列表
//      GET /md-preview/api/peek?path=…&sessionId=…   只读文件开头，返回
//                                              {title, snippet} 供列表卡片预览
export const name = 'md-preview'
export const inject = ['fs']

const MAX_RECENT = 30
const MAX_OPS = 5
const MAX_BYTES = 2 * 1024 * 1024

export function apply(ctx) {
  const recent = [] // { path, time, mtime, ops: [{op, time}], sessions: Set<sessionId> }

  function record(p, op, mtime, sessionId) {
    let entry = recent.find((f) => f.path === p)
    if (!entry) entry = { path: p, time: 0, mtime: mtime || 0, ops: [], sessions: new Set() }
    entry.time = Date.now()
    if (mtime) entry.mtime = mtime
    if (sessionId) entry.sessions.add(String(sessionId))
    if (op) {
      const now = Date.now()
      const last = entry.ops[0]
      // 同一操作在 10 秒内重复上报视为一次（消除重复胶囊）
      if (last && last.op === op && now - last.time < 10000) {
        last.time = now
      } else {
        entry.ops.unshift({ op, time: now })
        if (entry.ops.length > MAX_OPS) entry.ops.length = MAX_OPS
      }
    }
    const idx = recent.indexOf(entry)
    if (idx >= 0) recent.splice(idx, 1)
    recent.unshift(entry)
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT
    return entry
  }

  // 从执行工具上下文提取操作类型（读/写/改/删）
  function opFromActor(actor) {
    try {
      if (!actor) return null
      const name = String(actor.name || actor.toolName || '')
      const l = name.toLowerCase()
      if (l.includes('write')) return 'write'
      if (l.includes('edit')) {
        // 区分修改方向：增加行 / 删除内容 / 替换
        const a = actor.arguments
        const oldS = a && typeof a.old_string === 'string' ? a.old_string : null
        const newS = a && typeof a.new_string === 'string' ? a.new_string : null
        if (oldS !== null && newS !== null) {
          if (oldS === '' && newS !== '') return 'add'
          if (newS === '' && oldS !== '') return 'del'
          if (newS.length > oldS.length) return 'add'
          if (newS.length < oldS.length) return 'del'
        }
        return 'edit'
      }
      if (l.includes('delete') || l.includes('remove')) return 'delete'
      if (l.includes('read')) return 'read'
      return null
    } catch { return null }
  }

  // 从执行工具上下文提取会话 id（exec.agent.session 存在时）
  function sessionIdOf(exec) {
    try {
      if (!exec) return undefined
      const session = exec.agent && exec.agent.session
      if (!session) return undefined
      const id = typeof session.id === 'string' ? session.id
        : (session.header && session.header.id) || session.sessionId
      return typeof id === 'string' && id ? id : undefined
    } catch { return undefined }
  }

  function mtimeOf(info) {
    try {
      if (typeof info.mtimeMs === 'number') return info.mtimeMs
      if (typeof info.mtime === 'number') return info.mtime
      if (info.mtime instanceof Date) return info.mtime.getTime()
      if (info.updatedAt instanceof Date) return info.updatedAt.getTime()
    } catch { /* ignore */ }
    return 0
  }

  function refreshMtime(entry, path) {
    Promise.resolve().then(async () => {
      try {
        const target = await ctx.fs.resolve(path)
        const info = await ctx.fs.stat(target)
        if (info) {
          const mt = mtimeOf(info)
          if (mt) entry.mtime = mt
        }
      } catch { /* ignore */ }
    }).catch(() => { /* ignore */ })
  }

  ctx.on('fs/observed', (target, observation, actor) => {
    try {
      const path = target && (target.displayPath || target.path)
      if (typeof path !== 'string') return
      const lower = path.toLowerCase()
      if (!(lower.endsWith('.md') || lower.endsWith('.markdown'))) return
      let op = opFromActor(actor)
      if (observation && observation.kind === 'absent') op = 'delete'
      const sessionId = sessionIdOf(actor)
      const entry = record(path, op, 0, sessionId)
      refreshMtime(entry, path)
    } catch { /* recorder must stay silent */ }
  })

  function cwdOf(sessionId) {
    try {
      const sessions = ctx.get('sessions')
      if (!sessions || !sessionId) return undefined
      const session = sessions.get(String(sessionId))
      if (!session) return undefined
      const h = session.header
      const cwd = (h && h.meta && h.meta.cwd) || (h && h.cwd) || (session.meta && session.meta.cwd) || session.cwd
      return typeof cwd === 'string' ? cwd : undefined
    } catch { return undefined }
  }

  function cwdFromSession(session) {
    try {
      if (!session) return undefined
      const h = session.header
      const cwd = (h && h.meta && h.meta.cwd) || (h && h.cwd) || (session.meta && session.meta.cwd) || session.cwd
      return typeof cwd === 'string' ? cwd : undefined
    } catch { return undefined }
  }

  // 从 bash 命令里提取以 .md/.markdown 结尾的路径 token
  function parseRmPaths(cmd) {
    const out = []
    try {
      const tokens = String(cmd).split(/\s+/)
      for (const raw of tokens) {
        const tok = raw.replace(/^['"]|['"]$/g, '')
        if (/\.(md|markdown)$/i.test(tok) && !tok.startsWith('-')) out.push(tok)
      }
    } catch { /* ignore */ }
    return out
  }

  // bash rm 删除 md 文件：文件工具不会观测到，改为解析 tools/result 中的命令
  ctx.on('tools/result', (exec) => {
    try {
      const name = String(exec && exec.name ? exec.name : '')
      if (!name.toLowerCase().includes('bash')) return
      const args = exec.arguments
      const cmd = String(args && args.command ? args.command : '')
      if (!/\brm\b/.test(cmd)) return
      const session = exec.agent && exec.agent.session
      const cwd = cwdFromSession(session)
      const sid = sessionIdOf(exec)
      for (const p of parseRmPaths(cmd)) {
        const full = p.startsWith('/') ? p : (cwd ? (cwd.endsWith('/') ? cwd : cwd + '/') + p : null)
        if (!full) continue
        const entry = record(full, 'delete', 0, sid)
        // 异步验证文件确实不在了；仍在则撤销这次删除记录（例如 rm 失败）
        Promise.resolve().then(async () => {
          try {
            const target = await ctx.fs.resolve(full)
            const info = await ctx.fs.stat(target)
            if (info) {
              const i = entry.ops.findIndex((o) => o.op === 'delete')
              if (i >= 0) entry.ops.splice(i, 1)
            }
          } catch { /* ignore */ }
        }).catch(() => { /* ignore */ })
      }
    } catch { /* listener must stay silent */ }
  })

  function json(res, status, value) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(value))
  }

  async function resolveTarget(path, sessionId) {
    const cwd = cwdOf(sessionId)
    const target = await ctx.fs.resolve(path, cwd ? { cwd } : {})
    return { target, cwd }
  }

  // 用 ctx.inject 条件挂载：webServer 服务就绪后才注册路由。
  ctx.inject(['webServer'], (wctx) => {
    wctx.effect(() => {
      const disposeRecent = wctx.webServer.register({
        kind: 'exact',
        path: '/md-preview/api/recent',
        handler: async (req, res) => {
          if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
          const url = new URL(req.url ?? '/md-preview/api/recent', 'http://127.0.0.1')
          const sessionId = (url.searchParams.get('sessionId') ?? '').trim().slice(0, 256)
          const cwd = cwdOf(sessionId)
          const prefix = cwd ? (cwd.endsWith('/') ? cwd : cwd + '/') : null
          // 会话隔离：有 sessionId 时只返回该会话访问过的文件；
          // 无 sessionId 时回退到按 cwd 前缀过滤（兼容旧调用）。
          const files = recent
            .filter((f) => {
              if (sessionId) return f.sessions.has(sessionId)
              if (!prefix) return true
              return f.path === cwd || f.path.startsWith(prefix)
            })
            .map((f) => ({
              path: f.path,
              time: f.time,
              mtime: f.mtime || 0,
              ops: (f.ops || []).map((o) => ({ op: o.op, time: o.time })),
              rel: prefix && f.path.startsWith(prefix) ? f.path.slice(prefix.length) : null,
            }))
          json(res, 200, { files, scoped: Boolean(sessionId) })
        },
      })

      const disposeRead = wctx.webServer.register({
        kind: 'exact',
        path: '/md-preview/api/read',
        handler: async (req, res) => {
          if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
          const url = new URL(req.url ?? '/md-preview/api/read', 'http://127.0.0.1')
          const path = (url.searchParams.get('path') ?? '').slice(0, 2048)
          const sessionId = (url.searchParams.get('sessionId') ?? '').trim().slice(0, 256)
          if (!path) { json(res, 400, { ok: false, error: 'missing path query parameter' }); return }
          try {
            const { target } = await resolveTarget(path, sessionId)
            const info = await ctx.fs.stat(target)
            if (!info) { json(res, 404, { ok: false, error: 'file not found: ' + path }); return }
            if (typeof info.size === 'number' && info.size > MAX_BYTES) {
              json(res, 413, { ok: false, error: 'file too large for preview (>2MB): ' + path }); return
            }
            const text = await ctx.fs.readText(target)
            let display = path
            try { display = ctx.fs.processPath(target) } catch {}
            const lower = display.toLowerCase()
            if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
              record(display, 'read', mtimeOf(info), sessionId)
            }
            json(res, 200, { ok: true, path: display, text: String(text) })
          } catch (e) {
            json(res, 500, { ok: false, error: String(e && e.message ? e.message : e) })
          }
        },
      })

      const disposePeek = wctx.webServer.register({
        kind: 'exact',
        path: '/md-preview/api/peek',
        handler: async (req, res) => {
          if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
          const url = new URL(req.url ?? '/md-preview/api/peek', 'http://127.0.0.1')
          const path = (url.searchParams.get('path') ?? '').slice(0, 2048)
          const sessionId = (url.searchParams.get('sessionId') ?? '').trim().slice(0, 256)
          if (!path) { json(res, 400, { ok: false, error: 'missing path query parameter' }); return }
          try {
            const { target } = await resolveTarget(path, sessionId)
            const info = await ctx.fs.stat(target)
            if (!info) { json(res, 404, { ok: false, error: 'file not found: ' + path }); return }
            let buf = ''
            const stream = await ctx.fs.streamText(target)
            for await (const chunk of stream) {
              buf += chunk
              if (buf.length > 2000) break
            }
            const lines = String(buf).split('\n').map((l) => l.trim())
            let title = ''
            let snippet = ''
            for (const l of lines) {
              if (l.startsWith('# ') && !title) { title = l.slice(2).trim(); continue }
              if (!snippet && l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('|') && !l.startsWith('>') && !l.startsWith('-') && !l.startsWith('*') && !l.startsWith('<!') && !l.startsWith('---')) {
                snippet = l
              }
              if (title && snippet) break
            }
            if (!snippet) {
              snippet = lines.find((l) => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('|') && !l.startsWith('>') && !l.startsWith('-') && !l.startsWith('*') && !l.startsWith('<!') && !l.startsWith('---')) || ''
            }
            json(res, 200, { ok: true, title: title.slice(0, 120), snippet: snippet.slice(0, 180) })
          } catch (e) {
            json(res, 500, { ok: false, error: String(e && e.message ? e.message : e) })
          }
        },
      })

      return () => { disposeRecent(); disposeRead(); disposePeek() }
    })
  })
}
