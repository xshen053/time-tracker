export async function postLog(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
  if (ct.includes('application/json')) {
    try { return JSON.parse(text) } catch { /* fallthrough to text */ }
  }
  // If server returned plain text but it's valid JSON string, try parse; otherwise return text
  try { return JSON.parse(text) } catch { return text }
}

export async function fetchEvents(url: string) {
  const res = await fetch(url)
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
  if (ct.includes('application/json')) {
    const json = JSON.parse(text)
    // If the API returns { events: [...], count: N }
    if (json && Array.isArray(json.events)) return json
    // If the API returns an array directly, normalize it
    if (Array.isArray(json)) return { events: json, count: json.length }
    // Otherwise return the parsed body
    return json
  }
  // Non-JSON response — surface raw text for debugging
  throw new Error('Non-JSON response: ' + text)
}

export async function fetchLogs(url: string, eventName: string, nextKey?: string) {
  // Build query string using encodeURIComponent so spaces become %20 (not '+')
  // Use URL as base in case `url` is relative or absolute.
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const q = new URL(url, base)
  const params: string[] = []
  params.push('eventName=' + encodeURIComponent(eventName))
  if (nextKey) params.push('nextKey=' + encodeURIComponent(nextKey))
  q.search = params.join('&')

  const res = await fetch(q.toString())
  console.log(q.toString())
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  console.log(text)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
  if (ct.includes('application/json')) {
    let json = JSON.parse(text)
    // Some backends (API Gateway + Lambda proxy) return a wrapper like:
    // { statusCode: 200, headers: {...}, body: "{ \"data\": [...] }" }
    // If so, the actual payload is inside json.body as a string — parse it.
    if (json && typeof json.body === 'string') {
      try {
        json = JSON.parse(json.body)
      } catch (e) {
        // leave as-is if body is not JSON
      }
    }
    // Expected shape from backend: { data: [...], count, nextKey }
    return json
  }
  throw new Error('Non-JSON response: ' + text)
}
