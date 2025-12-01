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
