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
