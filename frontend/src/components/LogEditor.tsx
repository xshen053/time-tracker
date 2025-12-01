import React, { useState } from 'react'

type Props = {
  log: any
  onSave: (updates: { [k: string]: any }) => Promise<void>
}

export default function LogEditor({ log, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  // Helpers to normalize existing values into HTML input formats
  const parseDateToInput = (d: any, iso?: string) => {
    if (!d && iso) return iso.split('T')[0]
    if (!d) return ''
    // allow formats like 2025/11/30 or 2025-11-30
    const s = String(d).trim()
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return ''
  }

  const parseTimeToInput = (t: any, iso?: string) => {
    if (!t && iso) {
      try {
        const dt = new Date(iso)
        const hh = String(dt.getHours()).padStart(2, '0')
        const mm = String(dt.getMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      } catch { return '' }
    }
    if (!t) return ''
    const s = String(t).trim()
    // formats: '09:00:00 AM', '09:00 AM', '09:00:00', '09:00'
    const ampm = /\b(AM|PM)\b/i.test(s)
    const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
    if (!m) return ''
    let hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    const ap = m[4]
    if (ap) {
      const a = ap.toUpperCase()
      if (a === 'PM' && hh < 12) hh += 12
      if (a === 'AM' && hh === 12) hh = 0
    }
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2,'0')}`
  }

  const [date, setDate] = useState(parseDateToInput(log.date, log.isoStartTime))
  const [startTime, setStartTime] = useState(parseTimeToInput(log.startTime, log.isoStartTime))
  const [endTime, setEndTime] = useState(parseTimeToInput(log.endTime, log.isoStartTime))
  const [text, setText] = useState(log.text ?? '')

  async function save() {
    const updates: any = {}
    if (date !== log.date) updates.date = date
    if (startTime !== log.startTime) updates.startTime = startTime
    if (endTime !== log.endTime) updates.endTime = endTime
    if (text !== log.text) updates.text = text
    await onSave(updates)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        <div className="log-text">{String(log.text ?? '')}</div>
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setEditing(true)}>Edit</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>Date <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Start <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
        <label>End <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 8 }}>
        <textarea rows={3} style={{ width: '100%' }} value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={save}>Save</button>
        <button onClick={() => setEditing(false)} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
    </div>
  )
}
