import React, { useEffect, useState } from 'react'
import { postLog, fetchEvents, fetchLogs, createEvent } from './api'

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
    await loadLogs(ev.eventName)
  }

  async function loadLogs(eventName: string, next?: string) {
    setStatus('loading logs...')
    try {
  const resp = await fetchLogs(API + '/log', eventName, next)
      // backend returns { data: [...], count, nextKey }
      if (resp && Array.isArray(resp.data)) {
        setLogs(prev => [...prev, ...resp.data])
      }
      setNextKey(resp.nextKey)
      setStatus('logs loaded')
    } catch (err: any) {
      setStatus('error: ' + (err.message || String(err)))
    }
  }

  function backToList() {
    setScreen('list')
    setSelectedEvent(null)
    setLogs([])
  }

  return (
    <div className="app">
      <h1>Time Tracker</h1>
      <p>API endpoint: <code>{API}</code></p>

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
                <small style={{ marginLeft: 8 }}>{ev.createdAt}</small>
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
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {logs.map((l: any, i) => (
              <li key={i} className="log-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{l.startTime ?? l.isoStartTime ?? l.SK ?? ''}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{l.logId ?? ''}</div>
                </div>
                <div className="log-text">{String(l.text ?? '')}</div>
                <div style={{ marginTop: 6, color: '#444', fontSize: 12 }}>
                  <span>{l.eventName ?? ''}</span>
                  <span style={{ marginLeft: 12 }}>{l.date ?? ''}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Status</h2>
        <pre>{status}</pre>
      </section>
    </div>
  )
}
