export async function createEvent(url: string, eventName: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
  try { return JSON.parse(text) } catch { return text }
}
