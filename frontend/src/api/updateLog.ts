export async function updateLog(url: string, PK: string, SK: string, updates: Record<string, any>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ PK, SK, updates }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
  try { return JSON.parse(text) } catch { return text }
}
