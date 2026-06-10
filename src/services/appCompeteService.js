// AppCompete MCP client — Rank Tracker / ASO tools over Streamable HTTP JSON-RPC.
// Endpoint: POST https://appcompete.com/api/mcp with `Authorization: Bearer ac_live_…`.
// In the browser the call goes through the CORS proxy (`/api/appcompete/mcp`,
// see vite.config.js for dev and worker/index.js for production); Tauri calls direct.

const isTauri = () => '__TAURI__' in window

function getEndpoint() {
  if (isTauri()) return 'https://appcompete.com/api/mcp'
  const proxyBase = import.meta.env.VITE_ASC_PROXY_URL
  // Production: Worker routes /appcompete/* → https://appcompete.com/api/*
  // Dev: Vite proxies /api/appcompete/* → https://appcompete.com/api/*
  return proxyBase ? `${proxyBase}/appcompete/mcp` : '/api/appcompete/mcp'
}

let messageId = 0

// Streamable HTTP servers may answer JSON or SSE (`data: {...}` lines) — handle both.
async function parseRpcResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()

  if (contentType.includes('text/event-stream')) {
    let lastData = null
    for (const line of raw.split('\n')) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (payload && payload !== '[DONE]') {
          try { lastData = JSON.parse(payload) } catch { /* keep previous */ }
        }
      }
    }
    return lastData
  }

  try { return JSON.parse(raw) } catch {
    throw new Error(`Invalid AppCompete response: ${raw.slice(0, 120)}`)
  }
}

export async function callAppCompeteTool(apiKey, toolName, args = {}) {
  if (!apiKey) throw new Error('AppCompete API key is not configured')

  const response = await fetch(getEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++messageId,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('AppCompete rejected the API key — check it in the sidebar')
  }
  if (!response.ok) {
    throw new Error(`AppCompete request failed: ${response.status}`)
  }

  const data = await parseRpcResponse(response)
  if (!data) throw new Error('Empty AppCompete response')
  if (data.error) throw new Error(data.error.message || 'AppCompete tool error')

  const result = data.result || {}
  if (result.isError) {
    const msg = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ')
    throw new Error(msg || 'AppCompete tool error')
  }

  // Prefer structuredContent; otherwise try to JSON-parse the text content.
  if (result.structuredContent !== undefined) return result.structuredContent
  const text = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('')
  try { return JSON.parse(text) } catch { return text }
}

// ---------------------------------------------------------------------------
// Normalizers — tolerate the field-name variations of each tool's payload
// ---------------------------------------------------------------------------

function asArray(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  for (const key of ['keywords', 'suggestions', 'apps', 'items', 'results', 'data']) {
    if (Array.isArray(data[key])) return data[key]
  }
  return []
}

export function normalizeKeywordItems(data) {
  return asArray(data)
    .map(item => {
      if (typeof item === 'string') return { keyword: item }
      return {
        id: item.id ?? null,
        keyword: item.keyword ?? item.text ?? item.term ?? item.name ?? '',
        popularity: item.popularity ?? item.traffic ?? item.searchVolume ?? null,
        difficulty: item.difficulty ?? item.competition ?? null,
        position: item.position ?? item.rank ?? item.latestPosition ?? item.currentPosition ?? null,
        appsCount: item.appsCount ?? item.totalApps ?? null,
        opportunity: item.opportunity ?? item.score ?? null,
        note: item.note ?? null,
      }
    })
    .filter(k => k.keyword)
}

export function normalizeApps(data) {
  return asArray(data)
    .map(app => ({
      appleId: String(app.appleId ?? app.trackId ?? app.id ?? ''),
      name: app.name ?? app.trackName ?? app.title ?? 'Unknown app',
      icon: app.icon ?? app.artworkUrl ?? null,
      isOwn: app.isOwn ?? false,
      country: app.country ?? null,
      keywordCount: app.keywordCount ?? app.keywordsCount ?? (Array.isArray(app.keywords) ? app.keywords.length : null),
    }))
    .filter(a => a.appleId)
}

// ---------------------------------------------------------------------------
// Tool wrappers
// ---------------------------------------------------------------------------

export async function testAppCompeteConnection(apiKey) {
  try {
    const result = await callAppCompeteTool(apiKey, 'list_apps', {})
    return { success: true, message: 'Connected to AppCompete', data: result }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

export async function listApps(apiKey) {
  return normalizeApps(await callAppCompeteTool(apiKey, 'list_apps', {}))
}

export async function getKeywordSuggestions(apiKey, appleId, country = 'us') {
  const data = await callAppCompeteTool(apiKey, 'get_keyword_suggestions', {
    appleId: String(appleId), country,
  })
  return normalizeKeywordItems(data)
}

export async function getAppKeywords(apiKey, appleId, country = 'us') {
  const data = await callAppCompeteTool(apiKey, 'get_app_keywords', {
    appleId: String(appleId), country,
  })
  return normalizeKeywordItems(data)
}

export async function extractCompetitorKeywords(apiKey, appleId, country = 'us') {
  const data = await callAppCompeteTool(apiKey, 'extract_competitors_keywords', {
    appleId: String(appleId), country,
  })
  return normalizeKeywordItems(data)
}

export async function addKeywords(apiKey, appleId, keywords, country = 'us') {
  return callAppCompeteTool(apiKey, 'add_keywords', {
    appleId: String(appleId), keywords: keywords.slice(0, 20), country,
  })
}

// ---------------------------------------------------------------------------
// Keyword review — verdict + advice for each of the locale's current keywords,
// matched against the tracked data (position / popularity / difficulty).
// ---------------------------------------------------------------------------

export function reviewKeywords(currentKeywords, trackedItems) {
  const tracked = new Map(trackedItems.map(t => [t.keyword.toLowerCase(), t]))

  return currentKeywords.map(kw => {
    const t = tracked.get(kw.toLowerCase())
    if (!t) {
      return {
        keyword: kw, tracked: false, verdict: 'unknown',
        advice: 'Not tracked on AppCompete — add it to see rankings and popularity.',
      }
    }
    const base = { keyword: kw, tracked: true, position: t.position, popularity: t.popularity, difficulty: t.difficulty, note: t.note }
    if (t.position != null && t.position <= 10) {
      return { ...base, verdict: 'great', advice: `Ranked #${t.position} — keep it.` }
    }
    if (t.popularity != null && t.popularity < 15) {
      return { ...base, verdict: 'weak', advice: 'Very low search volume — consider replacing it.' }
    }
    if (t.difficulty != null && t.difficulty > 60) {
      return { ...base, verdict: 'hard', advice: 'Highly competitive — hard to rank, target a longer-tail variant.' }
    }
    if (t.position == null) {
      return { ...base, verdict: 'weak', advice: 'Tracked but not ranking — the app is invisible on this term.' }
    }
    return { ...base, verdict: 'ok', advice: `Ranked #${t.position} — room to grow.` }
  })
}
