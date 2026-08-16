// dsh-md-preview: DeepSeek Harness 插件（Client 半边）v0.4。
//
// 交互：
//   1. 会话头部「MD 预览」开关按钮；
//   2. 浮动窗：标题栏拖动 + 右下角调大小，位置/大小记忆（localStorage）；
//   3. 打开即显示本会话 md 卡片列表（前 10 条，其余折叠），卡片含
//      文件名 / 相对路径 / 标题 / 摘要 / 相对时间；
//   4. 列表自动收集会话读写的 md 与手动打开过的文件，可手动刷新；
//   5. 切换会话自动刷新为本会话列表；
//   6. 手动输入路径打开；
//   7. 「对话/轨迹」栏「MD 预览」整页页签。
window.__ModuleLoader__.load({
  id: 'dsh-md-preview',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var react = require('react')
    var useState = react.useState
    var useEffect = react.useEffect
    var useRef = react.useRef
    var createElement = react.createElement
    var Fragment = react.Fragment
    var useSyncExternalStore = react.useSyncExternalStore

    var CSS = '.mdp-panel{position:fixed;display:flex;flex-direction:column;background:var(--bg-elevated,#ffffff);border:1px solid var(--border,#d0d7de);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.25);z-index:999;overflow:hidden;font-size:13px;color:var(--text,#1f2328)}' +
      // dock：无阴影/无圆角/无边框，背景与 shell 一致，顶部与对话内容区对齐
      '.mdp-panel.mdp-dock{position:fixed;left:auto;right:0;top:0;bottom:0;border-radius:0;border:none;box-shadow:none;background:var(--dsw-alias-bg-base,var(--bg,#ffffff));z-index:40;border-left:1px solid var(--dsw-alias-border-l2,var(--border,#d0d7de))}' +
      '.mdp-dock-handle{position:absolute;left:-2px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:3;transition:background .12s}' +
      '.mdp-dock-handle::after{content:"";position:absolute;left:3px;top:0;bottom:0;width:2px;background:var(--dsw-alias-border-l2,var(--border,#d0d7de));opacity:.7}' +
      '.mdp-dock-handle:hover::after{background:var(--dsw-alias-accent-solid,var(--accent,#0969da));opacity:.9;width:3px}' +
      '.mdp-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border,#d0d7de);background:var(--bg-subtle,#f6f8fa);cursor:move;user-select:none;flex:none}' +
      '.mdp-head.mdp-head-dock{cursor:default;background:transparent;padding:12px 16px 10px}' +
      '.mdp-title{font-weight:600;font-size:13px}' +
      '.mdp-title.mdp-title-dock{font-size:14px;font-weight:500}' +
      '.mdp-btn{padding:4px 10px;border:1px solid var(--border,#d0d7de);border-radius:6px;background:var(--bg,#fff);cursor:pointer;font-size:12px;color:var(--text,#1f2328)}' +
      '.mdp-btn.mdp-btn-dock{border:none;background:transparent;color:var(--dsw-alias-label-secondary,var(--text,#1f2328));padding:4px 8px}' +
      '.mdp-btn.mdp-btn-dock:hover{background:var(--dsw-alias-interactive-bg-hover,var(--bg-subtle,#f6f8fa))}' +
      '.mdp-bar{display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border,#d0d7de);flex:none}' +
      '.mdp-bar.mdp-bar-dock{padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,var(--border,#d0d7de))}' +
      '.mdp-input{flex:1;padding:6px 8px;border:1px solid var(--border,#d0d7de);border-radius:6px;font-size:12px;background:var(--bg,#fff);color:var(--text,#1f2328)}' +
      '.mdp-list{flex:1;min-height:200px;overflow:auto;padding:6px 0}' +
      '.mdp-card{display:block;width:100%;text-align:left;padding:9px 16px;border:none;background:transparent;cursor:pointer;border-bottom:1px solid var(--border,#d0d7de)}' +
      '.mdp-card:hover{background:var(--bg-subtle,#f6f8fa)}' +
      '.mdp-card-top{display:flex;justify-content:space-between;gap:10px}' +
      '.mdp-card-name{font-weight:600;font-size:12.5px;color:var(--text,#1f2328);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}' +
      '.mdp-card-time{font-size:11px;opacity:.6;flex:none}' +
      '.mdp-card-rel{font-size:10.5px;opacity:.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}' +
      '.mdp-card-title{font-size:11.5px;font-weight:600;margin-top:4px;color:var(--text,#1f2328);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.mdp-card-snip{font-size:11px;opacity:.7;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.mdp-card-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;align-items:center}' +
      '.mdp-chip{font-size:10.5px;padding:1px 7px;border-radius:999px;border:1px solid var(--border,#d0d7de);background:var(--bg-subtle,#f6f8fa);color:var(--text,#1f2328)}' +
      '.mdp-chip-write{color:#0969da;border-color:#0969da66}' +
      '.mdp-chip-add{color:#1a7f37;border-color:#1a7f3766}' +
      '.mdp-chip-edit{color:#9a6700;border-color:#9a670066}' +
      '.mdp-chip-del{color:#c0392b;border-color:#c0392b66}' +
      '.mdp-chip-delete{color:#8b0000;border-color:#8b000066}' +
      '.mdp-chip-read{color:#57606a}' +
      '.mdp-chip-update{font-size:10.5px;opacity:.65}' +
      '.mdp-more{display:block;width:100%;text-align:left;padding:7px 16px;border:none;background:transparent;cursor:pointer;font-size:12px;color:#0969da}' +
      '.mdp-body{flex:1;min-height:0;overflow:auto;padding:14px 16px}' +
      '.mdp-view{height:100%;min-height:420px;display:flex;flex-direction:column;overflow:hidden;font-size:13px;color:var(--text,#1f2328);padding:0}' +
      '.mdp-view-head{padding:12px 16px;border-bottom:1px solid var(--border,#d0d7de);flex:none}' +
      '.mdp-view-title{font-weight:600;font-size:14px}' +
      '.mdp-resize{position:absolute;width:18px;height:18px;z-index:2;background:linear-gradient(135deg,transparent 50%,var(--border,#d0d7de) 50%)}' +
      '.mdp-rz-br{right:0;bottom:0;cursor:nwse-resize}' +
      '.mdp-rz-tl{left:0;top:0;cursor:nwse-resize}' +
      '.mdp-rz-tr{right:0;top:0;cursor:nesw-resize;background:linear-gradient(225deg,transparent 50%,var(--border,#d0d7de) 50%)}' +
      '.mdp-rz-bl{left:0;bottom:0;cursor:nesw-resize;background:linear-gradient(45deg,transparent 50%,var(--border,#d0d7de) 50%)}' +
      '.mdp-empty,.mdp-error{opacity:.7;padding:20px 16px}.mdp-error{color:#c0392b}' +
      // dock 列内的内容区：贴近 shell 详情面板的留白与分隔
      '.mdp-dock .mdp-list{padding:4px 0}' +
      '.mdp-dock .mdp-card{padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,var(--border,#d0d7de))}' +
      '.mdp-dock .mdp-body{padding:16px 18px}' +
      '.mdp-dock .mdp-render h1{font-size:19px}' +
      '.mdp-dock .mdp-render h2{font-size:16px}' +
      '.mdp-dock .mdp-more{padding:8px 16px}' +
      '.mdp-render{line-height:1.6;word-wrap:break-word}' +
      '.mdp-render h1,.mdp-render h2,.mdp-render h3,.mdp-render h4,.mdp-render h5,.mdp-render h6{margin:16px 0 8px;font-weight:600;line-height:1.3}' +
      '.mdp-render h1{font-size:20px;border-bottom:1px solid var(--border,#d0d7de);padding-bottom:6px}' +
      '.mdp-render h2{font-size:17px;border-bottom:1px solid var(--border,#d0d7de);padding-bottom:4px}' +
      '.mdp-render h3{font-size:15px}' +
      '.mdp-render p{margin:8px 0}' +
      '.mdp-render ul,.mdp-render ol{margin:8px 0;padding-left:22px}.mdp-render li{margin:3px 0}' +
      '.mdp-render code{background:var(--bg-subtle,#f0f2f4);padding:1px 5px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}' +
      '.mdp-render pre.mdp-code{background:var(--bg-subtle,#f6f8fa);border:1px solid var(--border,#d0d7de);border-radius:8px;padding:10px 12px;overflow:auto}' +
      '.mdp-render pre.mdp-code code{background:transparent;padding:0;display:block;font-size:12px}' +
      '.mdp-lang{display:block;font-size:10px;opacity:.6;margin-bottom:4px}' +
      '.mdp-render table.mdp-table{border-collapse:collapse;margin:10px 0;display:block;overflow:auto;max-width:100%}' +
      '.mdp-render table.mdp-table th,.mdp-render table.mdp-table td{border:1px solid var(--border,#d0d7de);padding:5px 9px;font-size:12px}' +
      '.mdp-render table.mdp-table th{background:var(--bg-subtle,#f6f8fa);font-weight:600}' +
      '.mdp-render blockquote{margin:8px 0;padding:2px 12px;border-left:3px solid var(--border,#d0d7de);color:var(--text-muted,#57606a)}' +
      '.mdp-render hr{border:none;border-top:1px solid var(--border,#d0d7de);margin:12px 0}' +
      '.mdp-render .mdp-math{font-family:ui-monospace,Menlo,monospace;background:var(--bg-subtle,#f0f2f4);padding:0 4px;border-radius:4px}' +
      '.mdp-render a{color:#0969da}' +
      '.mdp-open{padding:5px 12px;border:1px solid var(--border,#d0d7de);border-radius:6px;background:var(--bg,#fff);color:var(--text,#1f2328);cursor:pointer;font-size:12px}'

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
    function inline(text) {
      var t = String(text)
      var codes = []
      t = t.replace(/`([^`]+)`/g, function (_m, c) { codes.push(c); return '\u0000C' + (codes.length - 1) + '\u0000' })
      t = esc(t)
      t = t.replace(/\u0000C(\d+)\u0000/g, function (_m, i) { return '<code>' + esc(codes[+i]) + '</code>' })
      t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
      t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      t = t.replace(/\$([^$\n]+)\$/g, '<span class="mdp-math">$1</span>')
      return t
    }
    function cells(raw) {
      var c = String(raw).split('|')
      if (c[0].trim() === '') c = c.slice(1)
      if (c[c.length - 1].trim() === '') c = c.slice(0, -1)
      return c.map(function (s) { return s.trim() })
    }
    function mdToHtml(text) {
      var lines = String(text).replace(/\r\n/g, '\n').split('\n')
      var out = []
      var para = []
      function flushPara() {
        if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para.length = 0 }
      }
      var i = 0
      while (i < lines.length) {
        var line = lines[i]
        if (/^\s*$/.test(line)) { flushPara(); i++; continue }
        if (/^\s*```/.test(line)) {
          flushPara()
          var lang = esc(line.replace(/^\s*```/, '').trim())
          var buf = []
          i++
          while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(esc(lines[i])); i++ }
          i++
          out.push('<pre class="mdp-code">' + (lang ? '<span class="mdp-lang">' + lang + '</span>' : '') + '<code>' + buf.join('\n') + '</code></pre>')
          continue
        }
        var h = line.match(/^(#{1,6})\s+(.*)$/)
        if (h) { flushPara(); out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue }
        if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) { flushPara(); out.push('<hr>'); i++; continue }
        var bq = line.match(/^>\s?(.*)$/)
        if (bq) { flushPara(); out.push('<blockquote>' + inline(bq[1]) + '</blockquote>'); i++; continue }
        var ul = line.match(/^\s*[-*+]\s+(.*)$/)
        if (ul) {
          flushPara()
          out.push('<ul class="mdp-list">')
          while (i < lines.length && /^\s*[-*+]\s+(.*)$/.test(lines[i])) {
            var m1 = lines[i].match(/^\s*[-*+]\s+(.*)$/)
            out.push('<li>' + inline(m1[1]) + '</li>')
            i++
          }
          out.push('</ul>')
          continue
        }
        var ol = line.match(/^\s*\d+\.\s+(.*)$/)
        if (ol) {
          flushPara()
          out.push('<ol class="mdp-list">')
          while (i < lines.length && /^\s*\d+\.\s+(.*)$/.test(lines[i])) {
            var m2 = lines[i].match(/^\s*\d+\.\s+(.*)$/)
            out.push('<li>' + inline(m2[1]) + '</li>')
            i++
          }
          out.push('</ol>')
          continue
        }
        if (line.indexOf('|') >= 0 && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
          flushPara()
          var hcells = cells(line)
          out.push('<table class="mdp-table"><thead><tr>' + hcells.map(function (c) { return '<th>' + inline(c) + '</th>' }).join('') + '</tr></thead><tbody>')
          i += 2
          while (i < lines.length && lines[i].indexOf('|') >= 0 && lines[i].trim() !== '') {
            var r = cells(lines[i])
            if (r.length === 0 || r.every(function (c) { return c === '' })) break
            out.push('<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>' }).join('') + '</tr>')
            i++
          }
          out.push('</tbody></table>')
          continue
        }
        para.push(line)
        i++
      }
      flushPara()
      return out.join('\n')
    }

    function apiRead(path, sessionId) {
      var params = new URLSearchParams({ path: String(path) })
      if (sessionId) params.set('sessionId', String(sessionId))
      return fetch('/md-preview/api/read?' + params.toString(), { headers: { accept: 'application/json' } })
        .then(function (r) { return r.json() })
    }
    function apiRecent(sessionId) {
      var params = new URLSearchParams()
      if (sessionId) params.set('sessionId', String(sessionId))
      return fetch('/md-preview/api/recent?' + params.toString(), { headers: { accept: 'application/json' } })
        .then(function (r) { return r.json() })
    }
    function apiPeek(path, sessionId) {
      var params = new URLSearchParams({ path: String(path) })
      if (sessionId) params.set('sessionId', String(sessionId))
      return fetch('/md-preview/api/peek?' + params.toString(), { headers: { accept: 'application/json' } })
        .then(function (r) { return r.json() })
    }

    // ── 跨组件共享状态（订阅 + window CustomEvent 双桥接）──
    var open = false
    var docked = false
    var pendingOpen = null // { path, seq }：待打开路径；seq 自增保证重复点击同一路径也重新触发
    var pendingSeq = 0
    var currentSessionId = null
    var layoutSvc = null // 注入的 layout 服务（仅用于 dock 时关闭 shell details 列，避免双重压缩）
    var listeners = new Set()
    function emit(name, detail) {
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail: detail })) } catch (e) { /* ignore */ }
    }
    function notify() { listeners.forEach(function (f) { try { f() } catch (e) { /* ignore */ } }) }
    function setOpen(v) { if (open === v) return; open = v; notify(); emit('dsh-md-preview-open', open) }
    function setDocked(v) { if (docked === v) return; docked = v; notify(); emit('dsh-md-preview-dock', docked) }
    function requestOpenPath(path) {
      pendingSeq += 1
      pendingOpen = { path: String(path), seq: pendingSeq }
      setDocked(true)
      setOpen(true)
      // 布局让位由面板自己完成（给 AppFrame 加 paddingRight），不再打开 shell 的 details 列
      notify()
      emit('dsh-md-preview-path', pendingOpen)
    }
    function requestClose() {
      setOpen(false)
      // 面板关闭时恢复布局（解除 paddingRight 让位）
      try {
        var overlay = document.querySelector('[data-shell-overlay]')
        var frame = overlay && overlay.parentElement
        if (frame) frame.style.paddingRight = ''
      } catch (e) { /* ignore */ }
    }
    function setCurrentSession(sid) { if (currentSessionId === sid) return; currentSessionId = sid; notify(); emit('dsh-md-preview-session', currentSessionId) }
    function subscribe(f) { listeners.add(f); return function () { listeners.delete(f) } }
    function useExternal(getValue, eventName) {
      var state = useState(getValue())
      var v = state[0]
      var setV = state[1]
      useEffect(function () {
        function onStore() { setV(getValue()) }
        function onDom(ev) { setV(ev.detail) }
        var unsub = subscribe(onStore)
        if (typeof window !== 'undefined') window.addEventListener(eventName, onDom)
        return function () { unsub(); if (typeof window !== 'undefined') window.removeEventListener(eventName, onDom) }
      }, [])
      return v
    }
    function useOpen() { return useExternal(function () { return open }, 'dsh-md-preview-open') }
    function useDocked() { return useExternal(function () { return docked }, 'dsh-md-preview-dock') }
    function usePendingPath() { return useExternal(function () { return pendingOpen }, 'dsh-md-preview-path') }
    function useCurrentSession() { return useExternal(function () { return currentSessionId }, 'dsh-md-preview-session') }

    // ── 从标准 props 取当前会话 id（防注入缺失）──
    function findSessionId(snap) {
      try {
        if (!snap) return undefined
        if (typeof snap.id === 'string' && snap.id.indexOf('session') === 0) return snap.id
        if (typeof snap.sessionId === 'string') return snap.sessionId
        var h = snap.header
        if (h && typeof h.id === 'string') return h.id
        if (snap.meta && typeof snap.meta.id === 'string') return snap.meta.id
      } catch (e) { /* ignore */ }
      return undefined
    }
    function useSessionId(props) {
      var fromProps = props && props.sessionId
      if (typeof fromProps === 'string' && fromProps) return fromProps
      var useSession = props && props.useSession
      if (typeof useSession === 'function') {
        try {
          var snap = useSession()
          var found = findSessionId(snap)
          if (found) return found
        } catch (e) { /* 该槽位环境不可用时静默回退 */ }
      }
      return null
    }

    function fmtTime(t) {
      if (!t) return ''
      var d = Date.now() - t
      if (d < 60000) return '刚刚'
      if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前'
      if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前'
      try { return new Date(t).toLocaleDateString() } catch (e) { return '' }
    }
    var OP_LABEL = {
      write: '✍ 写入', add: '✚ 增加', edit: '✏ 修改',
      del: '✖ 删除', delete: '🗑 文件删除', read: '👁 读取',
    }
    var OP_ORDER = ['write', 'add', 'edit', 'del', 'delete', 'read']
    function opLabel(op) { return OP_LABEL[op] || null }
    function fmtUpdate(t) {
      if (!t) return ''
      var d = Date.now() - t
      if (d < 0) d = 0
      var when
      if (d < 60000) when = '刚刚'
      else if (d < 3600000) when = Math.floor(d / 60000) + ' 分钟前'
      else if (d < 86400000) when = Math.floor(d / 3600000) + ' 小时前'
      else when = Math.floor(d / 86400000) + ' 天前'
      if (d >= 86400000) return '🕐 更新于 ' + when + ' · 已 ' + Math.floor(d / 86400000) + ' 天未更新'
      return '🕐 更新于 ' + when
    }
    function basename(p) {
      var s = String(p).split('/')
      return s[s.length - 1] || p
    }

    // ── 列表卡片（懒加载 peek 摘要）──
    function FileCard(props) {
      var f = props.file
      var sessionId = props.sessionId
      var onClick = props.onClick
      var peekState = useState(null)
      var peek = peekState[0]
      var setPeek = peekState[1]
      useEffect(function () {
        var alive = true
        apiPeek(f.path, sessionId).then(function (r) {
          if (alive && r && r.ok) setPeek(r)
        }).catch(function () { /* peek 失败静默 */ })
        return function () { alive = false }
      }, [f.path, sessionId])
      // 每种操作类型只显示最近一次（固定顺序排列，去重）
      var latest = {}
      ;(Array.isArray(f.ops) ? f.ops : []).forEach(function (o) {
        if (!latest[o.op] && opLabel(o.op)) latest[o.op] = o
      })
      var chips = OP_ORDER.map(function (op) {
        var o = latest[op]
        if (!o) return null
        return createElement('span', { key: op, className: 'mdp-chip mdp-chip-' + op }, opLabel(op) + ' ' + fmtTime(o.time))
      }).filter(Boolean)
      return createElement('button', { className: 'mdp-card', onClick: onClick, title: f.path },
        createElement('div', { className: 'mdp-card-top' },
          createElement('span', { className: 'mdp-card-name' }, basename(f.path)),
          createElement('span', { className: 'mdp-card-time' }, fmtTime(f.time)),
        ),
        createElement('div', { className: 'mdp-card-rel' }, f.rel || f.path),
        (chips.length > 0 || f.mtime) ? createElement('div', { className: 'mdp-card-meta' },
          chips,
          f.mtime ? createElement('span', { className: 'mdp-chip-update' }, fmtUpdate(f.mtime)) : null,
        ) : null,
        peek && peek.title ? createElement('div', { className: 'mdp-card-title' }, peek.title) : null,
        peek && peek.snippet ? createElement('div', { className: 'mdp-card-snip' }, peek.snippet) : null,
      )
    }

    // ── 预览主体：卡片列表优先，点击卡片渲染 ──
    function PreviewBody(props) {
      var sessionId = props.sessionId
      var pendingPath = props.pendingPath || null
      var filesState = useState([])
      var files = filesState[0]
      var setFiles = filesState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var selectedState = useState(null)
      var selected = selectedState[0]
      var setSelected = selectedState[1]
      var inputState = useState('')
      var input = inputState[0]
      var setInput = inputState[1]
      var expandedState = useState(false)
      var expanded = expandedState[0]
      var setExpanded = expandedState[1]

      function openPath(path) {
        if (!path) return
        setBusy(true)
        apiRead(path, sessionId).then(function (r) {
          setBusy(false)
          setSelected(r && r.ok ? { path: r.path, text: r.text } : { path: String(path), error: r && r.error ? r.error : 'read failed' })
        }).catch(function (e) {
          setBusy(false)
          setSelected({ path: String(path), error: String(e && e.message ? e.message : e) })
        })
      }

      // 外部传入的路径（如点击对话中的 md 引用）自动打开
      var pendingRef = useRef(null)
      useEffect(function () {
        var p = props.pendingPath
        if (p && p.path && p.seq !== pendingRef.current) {
          pendingRef.current = p.seq
          openPath(p.path)
        }
      }, [props.pendingPath, sessionId])

      function fetchList() {
        setBusy(true)
        var alive = true
        apiRecent(sessionId).then(function (r) {
          if (!alive) return
          setFiles(Array.isArray(r && r.files) ? r.files : [])
          setBusy(false)
        }).catch(function () { if (alive) setBusy(false) })
        return function () { alive = false }
      }

      useEffect(function () {
        setFiles([])
        setSelected(null)
        setExpanded(false)
        return fetchList()
      }, [sessionId])

      var visible = expanded ? files : files.slice(0, 10)
      var hasMore = files.length > 10
      var dk = props.docked ? ' mdp-bar-dock' : ''

      var inputBar = createElement('div', { className: 'mdp-bar' + dk },
        createElement('input', {
          className: 'mdp-input',
          placeholder: '输入 .md 文件路径（相对工作目录）',
          value: input,
          onChange: function (e) { setInput(e.target.value) },
          onKeyDown: function (e) { if (e.key === 'Enter') openPath(input.trim()) },
        }),
        createElement('button', { className: 'mdp-btn' + dk, onClick: function () { openPath(input.trim()) } }, '打开'),
        createElement('button', { className: 'mdp-btn' + dk, onClick: function () { setSelected(null); fetchList() } }, '刷新'),
      )

      if (selected === null) {
        return createElement(Fragment, null,
          inputBar,
          createElement('div', { className: 'mdp-list' },
            busy ? createElement('div', { className: 'mdp-empty' }, '加载中…')
              : files.length === 0 ? createElement('div', { className: 'mdp-empty' }, '暂无记录：本会话读写/打开过的 .md 会自动出现在这里，点「刷新」手动更新')
              : createElement(Fragment, null,
                  visible.map(function (f) {
                    return createElement(FileCard, {
                      key: f.path,
                      file: f,
                      sessionId: sessionId,
                      onClick: function () { openPath(f.path) },
                    })
                  }),
                  hasMore ? createElement('button', { className: 'mdp-more', onClick: function () { setExpanded(!expanded) } },
                    expanded ? '收起' : '展开全部 ' + files.length + ' 条') : null,
                ),
          ),
        )
      }

      return createElement(Fragment, null,
        inputBar,
        createElement('div', { className: 'mdp-bar' + dk },
          createElement('button', { className: 'mdp-btn' + dk, onClick: function () { setSelected(null) } }, '← 返回列表'),
          createElement('span', { style: { fontSize: '11px', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, selected.path),
        ),
        createElement('div', { className: 'mdp-body' },
          busy ? createElement('div', { className: 'mdp-empty' }, '加载中…')
            : selected.error ? createElement('div', { className: 'mdp-error' }, selected.error)
            : createElement('div', {
                className: 'mdp-render',
                dangerouslySetInnerHTML: { __html: mdToHtml(selected.text) },
              }),
        ),
      )
    }

    // ── 错误边界：组件崩溃时显示可读错误，而不是整块空白/消失 ──
    class MdpBoundary extends react.Component {
      constructor(props) {
        super(props)
        this.state = { err: null }
      }
      componentDidCatch(err) {
        this.setState({ err: err })
      }
      render() {
        if (this.state.err) {
          return createElement('div', { style: { padding: '12px 16px', fontSize: '12px', color: '#c0392b' } },
            'MD 预览组件加载失败: ' + String(this.state.err && this.state.err.message ? this.state.err.message : this.state.err))
        }
        return this.props.children
      }
    }
    function wrap(Component) {
      return function (props) {
        return createElement(MdpBoundary, null, createElement(Component, props || {}))
      }
    }

    // ── 会话头部按钮 ──
    function PreviewButton(props) {
      var sid = useSessionId(props)
      useEffect(function () { if (sid) setCurrentSession(sid) }, [sid])
      var isOpen = useOpen()
      var btn = createElement('button', {
        className: 'mdp-open',
        title: '预览 Markdown 文件',
        onClick: function () {
          if (isOpen) requestClose()
          else setOpen(true)
        },
      }, isOpen ? '关闭预览' : 'MD 预览')
      return createElement(Fragment, null, createElement('style', null, CSS), btn)
    }

    // ── 可拖动 + 可调大小的浮动面板（位置/大小记忆）──
    var BOX_KEY = 'dsh-md-preview-box-v1'
    function loadBox() {
      try {
        var raw = window.localStorage.getItem(BOX_KEY)
        if (!raw) return null
        var p = JSON.parse(raw)
        if (p && typeof p.x === 'number' && typeof p.y === 'number' && typeof p.w === 'number' && typeof p.h === 'number') return p
      } catch (e) { /* ignore */ }
      return null
    }
    function persistBox(b) {
      try { window.localStorage.setItem(BOX_KEY, JSON.stringify(b)) } catch (e) { /* ignore */ }
    }

    function FloatingPanel() {
      var isOpen = useOpen()
      var isDocked = useDocked()
      var path = usePendingPath()
      var sid = useCurrentSession()
      var boxState = useState(function () { return loadBox() })
      var box = boxState[0]
      var setBox = boxState[1]
      var boxRef = useRef(box)
      var moveRef = useRef(null)
      var resizeRef = useRef(null)
      // dock 模式下面板完全自管：宽度可自由拖拽，顶部对齐对话内容区
      var dockWidthState = useState(400)
      var dockWidth = dockWidthState[0]
      var setDockWidth = dockWidthState[1]
      var dockTopState = useState(0)
      var dockTop = dockTopState[0]
      var setDockTop = dockTopState[1]
      var dockDragRef = useRef(null)

      // 布局让位：给 AppFrame 加 paddingRight，对话区自动变窄；
      // 同时关闭 shell 自带的 details 列（避免双重压缩）。
      function applyPadding(w) {
        try {
          var overlay = document.querySelector('[data-shell-overlay]')
          var frame = overlay && overlay.parentElement
          if (!frame) return
          frame.style.paddingRight = w + 'px'
          if (layoutSvc && layoutSvc.closeDetails) layoutSvc.closeDetails()
        } catch (e) { /* ignore */ }
      }
      function clearPadding() {
        try {
          var overlay = document.querySelector('[data-shell-overlay]')
          var frame = overlay && overlay.parentElement
          if (frame) frame.style.paddingRight = ''
        } catch (e) { /* ignore */ }
      }

      useEffect(function () {
        if (!isDocked) return
        var ro = null
        var raf = null
        function sync() {
          // 顶部对齐对话内容区（header 高度变化时同步）
          try {
            var scroll = document.querySelector('[data-conversation-scroll]')
            if (scroll) {
              var top = scroll.getBoundingClientRect().top
              if (Number.isFinite(top)) setDockTop(Math.max(0, Math.round(top)))
            }
          } catch (e) { /* ignore */ }
        }
        sync()
        raf = requestAnimationFrame(sync)
        applyPadding(dockWidth)
        try {
          var scroll = document.querySelector('[data-conversation-scroll]')
          if (scroll && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(sync)
            ro.observe(scroll)
            ro.observe(scroll.parentElement)
          }
        } catch (e) { /* ignore */ }
        return function () {
          if (ro) ro.disconnect()
          if (raf) cancelAnimationFrame(raf)
          clearPadding()
        }
      }, [isDocked])

      // 宽度变化时同步让位
      useEffect(function () {
        if (isDocked) applyPadding(dockWidth)
      }, [dockWidth, isDocked])

      function onDockResizeDown(e) {
        dockDragRef.current = { sx: e.clientX, sw: dockWidth }
        if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
        e.stopPropagation()
      }
      function onDockResizeMove(e) {
        var d = dockDragRef.current
        if (!d) return
        var vw = typeof window !== 'undefined' ? window.innerWidth : 1400
        var maxW = Math.round(vw * 0.62)
        var nw = Math.max(320, Math.min(d.sw + (d.sx - e.clientX), maxW))
        setDockWidth(nw)
      }
      function onDockResizeUp() { dockDragRef.current = null }

      function defaultBox() {
        var w = typeof window !== 'undefined' ? window.innerWidth : 1400
        var h = typeof window !== 'undefined' ? window.innerHeight : 900
        return { x: Math.max(8, w - 585), y: 72, w: 560, h: Math.min(Math.round(h * 0.78), 720) }
      }
      var b = box || defaultBox()

      function onMoveDown(e) {
        if (isDocked) return
        // 不在按下时捕获指针：否则标题栏内按钮（如「关闭」）的 click 会被吃掉。
        // 仅当实际拖动超过阈值后再捕获。
        moveRef.current = { sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, started: false, target: e.currentTarget, pointerId: e.pointerId }
      }
      function onMoveMove(e) {
        var d = moveRef.current
        if (!d || isDocked) return
        if (!d.started) {
          if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 6) return
          d.started = true
          if (d.target && d.target.setPointerCapture) d.target.setPointerCapture(d.pointerId)
        }
        var w = typeof window !== 'undefined' ? window.innerWidth : 1400
        var h = typeof window !== 'undefined' ? window.innerHeight : 900
        var nx = Math.min(Math.max(0, d.ox + e.clientX - d.sx), Math.max(0, w - 120))
        var ny = Math.min(Math.max(0, d.oy + e.clientY - d.sy), Math.max(0, h - 48))
        var nb = { x: nx, y: ny, w: b.w, h: b.h }
        boxRef.current = nb
        setBox(nb)
      }
      function onMoveUp() {
        var d = moveRef.current
        moveRef.current = null
        if (d && d.started) persistBox(boxRef.current || b)
      }

      function onResizeDown(dir) {
        return function (e) {
          if (isDocked) return
          resizeRef.current = { sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, ow: b.w, oh: b.h, dx: dir.dx, dy: dir.dy }
          if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
          e.stopPropagation()
        }
      }
      function onResizeMove(e) {
        var d = resizeRef.current
        if (!d || isDocked) return
        var vw = typeof window !== 'undefined' ? window.innerWidth : 1400
        var vh = typeof window !== 'undefined' ? window.innerHeight : 900
        var nx = d.ox
        var ny = d.oy
        var nw = d.ow
        var nh = d.oh
        if (d.dx > 0) {
          nw = Math.max(320, Math.min(d.ow + (e.clientX - d.sx), vw - d.ox - 8))
        } else if (d.dx < 0) {
          nx = Math.max(0, Math.min(d.ox + (e.clientX - d.sx), d.ox + d.ow - 320))
          nw = d.ox + d.ow - nx
        }
        if (d.dy > 0) {
          nh = Math.max(240, Math.min(d.oh + (e.clientY - d.sy), vh - d.oy - 8))
        } else if (d.dy < 0) {
          ny = Math.max(0, Math.min(d.oy + (e.clientY - d.sy), d.oy + d.oh - 240))
          nh = d.oy + d.oh - ny
        }
        var nb = { x: nx, y: ny, w: nw, h: nh }
        boxRef.current = nb
        setBox(nb)
      }
      function onResizeUp() { resizeRef.current = null; persistBox(boxRef.current || b) }

      var RESIZE_HANDLES = [
        { dir: { dx: -1, dy: -1 }, cls: 'mdp-rz-tl' },
        { dir: { dx: 1, dy: -1 }, cls: 'mdp-rz-tr' },
        { dir: { dx: -1, dy: 1 }, cls: 'mdp-rz-bl' },
        { dir: { dx: 1, dy: 1 }, cls: 'mdp-rz-br' },
      ]

      if (!isOpen) return null
      var panelStyle = isDocked
        ? { right: '0px', top: dockTop + 'px', bottom: '0px', width: dockWidth + 'px' }
        : { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' }
      return createElement('div', {
        className: 'mdp-panel' + (isDocked ? ' mdp-dock' : ''),
        style: panelStyle,
      },
        createElement('style', null, CSS),
        // dock 模式：左缘拖拽手柄（拖宽面板）
        isDocked ? createElement('div', {
          className: 'mdp-dock-handle',
          title: '拖动调整宽度',
          onPointerDown: onDockResizeDown,
          onPointerMove: onDockResizeMove,
          onPointerUp: onDockResizeUp,
        }) : null,
        createElement('div', {
          className: 'mdp-head' + (isDocked ? ' mdp-head-dock' : ''),
          onPointerDown: onMoveDown,
          onPointerMove: onMoveMove,
          onPointerUp: onMoveUp,
        },
          createElement('span', { className: 'mdp-title' + (isDocked ? ' mdp-title-dock' : '') },
            'Markdown 预览'),
          createElement('span', null,
            createElement('button', {
              className: 'mdp-btn' + (isDocked ? ' mdp-btn-dock' : ''),
              style: { marginRight: '6px' },
              title: isDocked ? '切换为浮动窗口' : '停靠到右侧并排',
              onPointerDown: function (e) { e.stopPropagation() },
              onClick: function () { setDocked(!isDocked) },
            }, isDocked ? '浮动' : '停靠'),
            createElement('button', {
              className: 'mdp-btn' + (isDocked ? ' mdp-btn-dock' : ''),
              title: '关闭预览',
              onPointerDown: function (e) { e.stopPropagation() },
              onClick: function () { requestClose() },
            }, '✕'),
          ),
        ),
        createElement(PreviewBody, { sessionId: sid, pendingPath: path, docked: isDocked }),
        isDocked ? null : RESIZE_HANDLES.map(function (h) {
          return createElement('div', {
            key: h.cls,
            className: 'mdp-resize ' + h.cls,
            onPointerDown: onResizeDown(h.dir),
            onPointerMove: onResizeMove,
            onPointerUp: onResizeUp,
          })
        }),
      )
    }

    // ── 整页视图（「对话/轨迹」栏页签）──
    function ViewPage(props) {
      var sid = useSessionId(props)
      return createElement('div', { className: 'mdp-view' },
        createElement('style', null, CSS),
        createElement('div', { className: 'mdp-view-head' },
          createElement('span', { className: 'mdp-view-title' }, 'Markdown 预览'),
        ),
        createElement(PreviewBody, { sessionId: sid }),
      )
    }
    // ── 拦截对话中 md 文件引用点击：默认改为右侧停靠预览，不再跳系统应用 ──
    // 对话中的 md 引用有三类按钮：产物芯片（title=路径）、行内 fileMention
    // （title=路径）、工具卡片 fileLink 按钮（无 title/aria-label，文本即完整路径）。
    // 在 document 捕获阶段拦截，阻止 React 的 openFile → 跳 VSCode。
    function isMdPath(p) {
      return typeof p === 'string' && /\.(md|markdown)$/i.test(p.trim())
    }
    function pathOfButton(btn) {
      var p = btn.getAttribute ? (btn.getAttribute('title') || btn.getAttribute('aria-label') || '') : ''
      p = p.replace(/^打开\s+/, '').trim()
      if (isMdPath(p)) return p
      // 兜底：按钮文本本身是 md 路径（fileLink 按钮）
      var txt = (btn.textContent || '').trim()
      if (isMdPath(txt) && (txt.indexOf('/') >= 0 || txt.indexOf('\\') >= 0)) return txt
      return null
    }
    function onClickCapture(e) {
      // 带修饰键点击保留原行为（系统默认应用打开）
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      var t = e.target
      if (!t || typeof t.closest !== 'function') return
      var btn = t.closest('button')
      if (!btn) return
      // 不拦截插件自己的面板 / 页签
      if (btn.closest('.mdp-panel') || btn.closest('.mdp-view')) return
      var path = pathOfButton(btn)
      if (!path) return
      e.preventDefault()
      e.stopPropagation()
      requestOpenPath(path)
    }

    exports.inject = ['slots', 'layout']
    exports.apply = function (ctx) {
      var disposeClick = null
      try {
        if (typeof document !== 'undefined') {
          document.addEventListener('click', onClickCapture, true)
          disposeClick = function () { document.removeEventListener('click', onClickCapture, true) }
        }
      } catch (e) { /* ignore */ }
      ctx.inject(['slots', 'layout'], function (scope) {
        layoutSvc = scope.layout || null
        scope.slots.inject('conversation.session.header.actions', function () {
          return scope.slots.register({
            name: 'conversation.session.header.actions',
            id: 'md-preview',
            order: 100,
            inject: function (sessionId) { return sessionId ? { sessionId: sessionId } : {} },
          }, wrap(PreviewButton))
        })
        scope.slots.inject('shell.overlay', function () {
          return scope.slots.register({
            name: 'shell.overlay',
            id: 'md-preview-panel',
            order: 100,
          }, wrap(FloatingPanel))
        })
        scope.slots.inject('conversation.view', function () {
          return scope.slots.register({
            name: 'conversation.view',
            id: 'md-preview-view',
            order: 20,
            label: 'MD 预览',
            inject: function (sessionId) { return sessionId ? { sessionId: sessionId } : {} },
          }, wrap(ViewPage))
        })
      })
      return function () { if (disposeClick) disposeClick() }
    }

    return module.exports
  },
})
