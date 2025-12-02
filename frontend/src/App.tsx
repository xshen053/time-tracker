import React, { useEffect, useState } from 'react'
import { postLog, fetchEvents, fetchLogs, createEvent, updateLog, deleteLog } from './api'
import LogEditor from './components/LogEditor'

const API = import.meta.env.VITE_API_ENDPOINT ?? 'http://localhost:3000'

type EventItem = { eventId: string, eventName: string, createdAt?: string }
type LogItem = any

export default function App() {
  // global UI state
  const [screen, setScreen] = useState<'list' | 'detail'>('list')
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [nextKey, setNextKey] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<string | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showToday, setShowToday] = useState(false)
  const [todayItems, setTodayItems] = useState<any[]>([])
  const [debugTimes, setDebugTimes] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  async function loadEvents() {
    setStatus('loading events...')
    try {
      const resp = await fetchEvents(API + '/events')
      const list = Array.isArray(resp.events) ? resp.events : []
      setEvents(list)
      setStatus('events loaded')
    } catch (err: any) {
      setStatus('error: ' + (err.message || String(err)))
    }
  }

  // create new event
  const [newEventName, setNewEventName] = useState('')
  async function submitNewEvent() {
    if (!newEventName) return setStatus('enter event name')
    setStatus('creating event...')
    try {
      await createEvent(API + '/events', newEventName)
      setNewEventName('')
      setStatus('event created')
      // refresh
      await loadEvents()
    } catch (err: any) {
      setStatus('error: ' + (err.message || String(err)))
    }
  }

  // Auto-load events when the list screen is shown
  useEffect(() => {
    if (screen === 'list' && events.length === 0) {
      loadEvents()
    }
  }, [screen])

  async function openEvent(ev: EventItem) {
    setSelectedEvent(ev)
    setLogs([])
    setNextKey(undefined)
    setScreen('detail')
    await loadLogs(ev.eventName, undefined, true)
  }

  async function loadLogs(eventName: string, next?: string, replace: boolean = false) {
  setStatus('loading logs...')
  setLoadingLogs(true)
    try {
  const resp = await fetchLogs(API + '/log', eventName, next)
      // backend returns { data: [...], count, nextKey }
      if (resp && Array.isArray(resp.data)) {
        if (replace) {
          setLogs(resp.data)
        } else {
          setLogs(prev => [...prev, ...resp.data])
        }
      }
      setNextKey(resp.nextKey)
      setStatus('logs loaded')
    } catch (err: any) {
      setStatus('error: ' + (err.message || String(err)))
    }
    finally {
      setLoadingLogs(false)
    }
  }

  // New log form state (only used on detail screen)
  const [logDate, setLogDate] = useState('')
  const [logStartTime, setLogStartTime] = useState('09:00')
  const [logEndTime, setLogEndTime] = useState('10:00')
  const [logText, setLogText] = useState('')

  async function submitNewLog() {
    if (!selectedEvent) return
    if (!logDate || !logStartTime || !logEndTime) return setStatus('fill date/start/end')
    setStatus('writing log...')
    try {
      // Convert local date/time into UTC date and UTC time strings so backend stores UTC
  const localStart = new Date(`${logDate}T${logStartTime}`)
  const localEnd = new Date(`${logDate}T${logEndTime}`)
  const toUtcDate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
  const toUtcTime = (d: Date) => `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:00Z`
  const isoEnd = localEnd.toISOString()
      const payload = {
        eventName: selectedEvent.eventName,
        date: toUtcDate(localStart),
        startTime: toUtcTime(localStart),
  endTime: toUtcTime(localEnd),
  isoEndTime: isoEnd,
        text: logText,
      }
      await postLog(API + '/log', payload)
      setStatus('log written')
      // clear and reload
      setLogText('')
  await loadLogs(selectedEvent.eventName, undefined, true)
    } catch (err: any) {
      setStatus('error: ' + (err.message || String(err)))
    }
  }

  // Helpers to compute duration between isoStartTime and endTime
  function parseEndDate(startIso: string | undefined, dateStr: string | undefined, endTimeStr: string | undefined) {
    if (!endTimeStr) return null
    try {
      // If we have a start ISO, use its date portion; otherwise use provided dateStr
      const datePart = startIso ? String(startIso).split('T')[0] : (dateStr ?? '')
      // If endTimeStr already looks like an ISO time, try parsing directly
      if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:?\d{0,2}Z?/.test(endTimeStr)) {
        const dt = new Date(endTimeStr)
        if (!isNaN(dt.getTime())) return dt
      }
      // endTimeStr format like '10:30:00 AM' or '10:30 AM' or '17:30'
      const m = endTimeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
      if (!m) return null
      let hh = parseInt(m[1], 10)
      const mm = parseInt(m[2], 10)
      const ss = m[3] ? parseInt(m[3], 10) : 0
      const ampm = m[4]
      if (ampm) {
        const a = ampm.toUpperCase()
        if (a === 'PM' && hh < 12) hh += 12
        if (a === 'AM' && hh === 12) hh = 0
      }
      // Build ISO string in UTC using datePart and hh:mm:ss
      const iso = `${datePart}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}Z`
      return new Date(iso)
    } catch (e) {
      return null
    }
  }

  function formatDuration(ms: number | null) {
    if (ms === null || isNaN(ms)) return ''
    const totalMinutes = Math.round(ms / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  function backToList() {
    setScreen('list')
    setSelectedEvent(null)
    setLogs([])
  }

  // Helpers for computing start/end Date objects and duration robustly
  function computeTimes(item: any) {
    // start: prefer isoStartTime, else compose from date + startTime
    let start: Date | null = null
    if (item.isoStartTime) {
      start = new Date(item.isoStartTime)
    } else if (item.date && item.startTime) {
      const s = String(item.startTime)
      const startIso = s.includes('T') ? s : `${item.date}T${s}${s.endsWith('Z') ? '' : 'Z'}`
      start = new Date(startIso)
    }

    // end: try endTime; if looks like ISO, parse; else compose from date + endTime
    let end: Date | null = null
    if (item.endTime) {
      const e = String(item.endTime)
      if (/\d{4}-\d{2}-\d{2}T/.test(e)) {
        end = new Date(e)
      } else if (item.date) {
        const endIso = `${item.date}T${e}${e.endsWith('Z') ? '' : 'Z'}`
        end = new Date(endIso)
      }
    }

    // If both parsed, normalize: if end < start, assume end on next day
    if (start && end && end.getTime() < start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
    }

    const durationMs = (start && end) ? (end.getTime() - start.getTime()) : null
    return { start, end, durationMs }
  }

  // --- Today timeline: fetch logs across events for today's date
  function isoDateToday() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  // initialize selectedDate on first render
  useEffect(() => {
    if (!selectedDate) setSelectedDate(isoDateToday())
  }, [])

  async function loadTodayTimeline(dateArg?: string) {
    const dateToUse = dateArg ?? selectedDate ?? isoDateToday()
    setStatus('loading timeline for ' + dateToUse + '...')
    setShowToday(true)
    try {
      const eventsResp = await fetchEvents(API + '/events')
      const evs = Array.isArray(eventsResp.events) ? eventsResp.events : []
      const targetDate = dateToUse
      const all: any[] = []
      for (const ev of evs) {
        try {
          // fetch logs for event (first page). We'll filter by local date on the client
          const resp = await fetchLogs(API + '/log', ev.eventName)
          if (resp && Array.isArray(resp.data)) {
            for (const item of resp.data) {
              // Obtain ISO timestamp: prefer isoStartTime, fall back to SK which is 'TIME#<iso>'
              const iso = item.isoStartTime ?? (item.SK ? String(item.SK).replace(/^TIME#/, '') : null)
              if (!iso) continue
              const dt = new Date(iso)
              if (isNaN(dt.getTime())) continue
              // Build local YYYY-MM-DD
              const y = dt.getFullYear()
              const m = String(dt.getMonth() + 1).padStart(2, '0')
              const d = String(dt.getDate()).padStart(2, '0')
              const localDate = `${y}-${m}-${d}`
              if (localDate === targetDate) {
                all.push({ ...item, eventName: ev.eventName })
              }
            }
          }
        } catch (e) {
          // ignore per-event failures
        }
      }
      // sort by isoStartTime or SK
      all.sort((a,b) => {
        const ta = new Date(a.isoStartTime ?? a.SK ?? 0).getTime()
        const tb = new Date(b.isoStartTime ?? b.SK ?? 0).getTime()
        return ta - tb
      })
      setTodayItems(all)
      setStatus('timeline loaded')
    } catch (err: any) {
      setStatus('error: ' + (err.message || String(err)))
    }
  }

  function changeDateBy(days: number) {
    const cur = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
    cur.setDate(cur.getDate() + days)
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    const next = `${y}-${m}-${d}`
    setSelectedDate(next)
    loadTodayTimeline(next)
  }

  return (
    <div className="app">
      <h1>Time Tracker</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ margin: 0 }}>API endpoint: <code>{API}</code></p>
        <button onClick={() => { setShowToday(false); setScreen('list') }}>Events</button>
  <button onClick={() => { loadTodayTimeline() }}>Today</button>
  <button onClick={() => setDebugTimes(d => !d)} style={{ marginLeft: 8 }}>{debugTimes ? 'Hide debug' : 'Show debug'}</button>
      </div>

      {screen === 'list' && (
        <section className="card">
          <h2>Events</h2>
          <div style={{ marginBottom: 8 }}>
            <button onClick={loadEvents}>Load Events</button>
          </div>

          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <h3>Create event</h3>
            <input placeholder="Event name" value={newEventName} onChange={e => setNewEventName(e.target.value)} />
            <button style={{ marginLeft: 8 }} onClick={submitNewEvent}>Create</button>
          </div>
          <ul>
            {events.map((ev) => (
              <li key={ev.eventId}>
                  <button onClick={() => openEvent(ev)}>{ev.eventName}</button>
                  <small style={{ marginLeft: 8 }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ev.createdAt}</small>
                </li>
            ))}
          </ul>
        </section>
      )}

      {showToday && (
        <section className="card">
          <h2>Timeline</h2>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowToday(false)}>Back</button>
            <button onClick={() => changeDateBy(-1)}>&larr;</button>
            <input type="date" value={selectedDate ?? isoDateToday()} onChange={e => { setSelectedDate(e.target.value); loadTodayTimeline(e.target.value) }} />
            <button onClick={() => changeDateBy(1)}>&rarr;</button>
            <div style={{ marginLeft: 12, color: '#666' }}>Showing local date: {selectedDate ?? isoDateToday()}</div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {todayItems.map((it: any, idx) => (
              <li key={idx} className="log-item">
                <div style={{ fontWeight: 700 }}>{it.isoStartTime ? new Date(it.isoStartTime).toLocaleTimeString() : (it.startTime ?? (it.SK ?? ''))}</div>
                <div style={{ color: '#666' }}>{it.eventName}</div>
                <div className="log-text" style={{ marginTop: 6 }}>{it.text}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === 'detail' && selectedEvent && (
        <section className="card">
          <h2>{selectedEvent.eventName}</h2>
          <div style={{ marginBottom: 8 }}>
            <button onClick={backToList}>Back</button>
            <button onClick={() => loadLogs(selectedEvent.eventName, nextKey)} disabled={!nextKey} style={{ marginLeft: 8 }}>Load more</button>
          </div>
          {loadingLogs && <div style={{ color: '#666', marginBottom: 8 }}>Reloading logs...</div>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {logs.map((l: any, i) => (
              <li key={i} className="log-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{(l.isoStartTime ? new Date(l.isoStartTime).toLocaleString() : (l.startTime ?? (l.SK ? String(l.SK).replace(/^TIME#/, '') : '')))}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{l.logId ?? ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  <div><strong>Start:</strong> {l.isoStartTime ? new Date(l.isoStartTime).toLocaleTimeString() : (l.startTime ?? '')}</div>
                  <div><strong>End:</strong> {l.isoStartTime ? (l.endTime ? (() => {
                    const raw = String(l.endTime)
                    const iso = raw.includes('T') ? raw : `${l.date}T${raw}${raw.endsWith('Z') ? '' : 'Z'}`
                    const dt = new Date(iso)
                    return isNaN(dt.getTime()) ? raw : dt.toLocaleTimeString()
                  })() : '') : (l.endTime ?? '')}</div>
                  <div>
                    <strong>Duration:</strong>{' '}
                    {(() => {
                      const startIso = l.isoStartTime ?? null
                      const endDate = parseEndDate(l.isoStartTime, l.date, l.endTime)
                      if (startIso && endDate) {
                        const diff = endDate.getTime() - new Date(startIso).getTime()
                        return formatDuration(diff)
                      }
                      return ''
                    })()}
                  </div>
                </div>
                {/* Edit controls */}
                <LogEditor
                  log={l}
                  disabled={loadingLogs}
                    onSave={async (updates) => {
                    try {
                      await updateLog(API + '/log', l.PK, l.SK, updates)
                      // reload logs for this event
                      await loadLogs(selectedEvent!.eventName, undefined, true)
                      setStatus('log updated')
                    } catch (err: any) {
                      setStatus('error: ' + (err.message || String(err)))
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteLog(API + '/log', l.PK, l.SK)
                      await loadLogs(selectedEvent!.eventName, undefined, true)
                      setStatus('log deleted')
                    } catch (err: any) {
                      setStatus('error: ' + (err.message || String(err)))
                    }
                  }}
                />
                <div style={{ marginTop: 6, color: '#444', fontSize: 12 }}>
                  <span>{l.eventName ?? ''}</span>
                  <span style={{ marginLeft: 12 }}>{(l.isoStartTime ? new Date(l.isoStartTime).toLocaleDateString() : (l.date ?? ''))}</span>
                </div>
                {debugTimes && (
                  (() => {
                    const { start, end, durationMs } = computeTimes(l)
                    return (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#333' }}>
                        <div>raw isoStartTime: {String(l.isoStartTime ?? '')}</div>
                        <div>raw startTime: {String(l.startTime ?? '')}, raw endTime: {String(l.endTime ?? '')}</div>
                        <div>parsed start: {start ? start.toString() : 'N/A'}</div>
                        <div>parsed end: {end ? end.toString() : 'N/A'}</div>
                        <div>duration: {durationMs === null ? 'N/A' : formatDuration(durationMs)}</div>
                      </div>
                    )
                  })()
                )}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #ddd' }}>
            <h3>Add new log</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label>
                Date
                <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
              </label>
              <label>
                Start
                <input type="time" value={logStartTime} onChange={e => setLogStartTime(e.target.value)} />
              </label>
              <label>
                End
                <input type="time" value={logEndTime} onChange={e => setLogEndTime(e.target.value)} />
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <textarea rows={4} style={{ width: '100%' }} placeholder="Log text" value={logText} onChange={e => setLogText(e.target.value)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={submitNewLog}>Add Log</button>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Status</h2>
        <pre>{status}</pre>
      </section>
    </div>
  )
}
