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
