export async function deleteLog(url: string, PK: string, SK: string) {
  // Use HTTP DELETE on the same /log endpoint; include PK/SK in JSON body.
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ PK, SK }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`)
  try { return JSON.parse(text) } catch { return text }
}
