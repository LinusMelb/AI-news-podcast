import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Voice {
  id: string
  name: string
}

type Status = 'idle' | 'loading' | 'playing' | 'error'

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [voiceId, setVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb')
  const [voices, setVoices] = useState<Voice[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const prevAudioUrl = useRef<string | null>(null)

  useEffect(() => {
    fetch('/voices')
      .then((r) => r.json())
      .then((data: Voice[]) => setVoices(data))
      .catch(() => {/* voices list is optional */})
  }, [])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      // Revoke previous object URL to avoid memory leaks
      if (prevAudioUrl.current) URL.revokeObjectURL(prevAudioUrl.current)
      prevAudioUrl.current = audioUrl
      audioRef.current.load()
      audioRef.current.play()
      setStatus('playing')
    }
  }, [audioUrl])

  async function handleGenerate() {
    if (!prompt.trim()) return
    setError('')
    setAudioUrl(null)
    setStatus('loading')

    try {
      const res = await fetch('/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt, voice_id: voiceId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      setAudioUrl(URL.createObjectURL(blob))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setStatus('error')
    }
  }

  const isLoading = status === 'loading'

  return (
    <div className="container">
      <header className="header">
        <div className="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <h1>AI News Podcast</h1>
        <p className="subtitle">Type a topic or paste text — get an audio briefing instantly</p>
      </header>

      <main className="main">
        <div className="card">
          <label htmlFor="prompt-input" className="label">Your prompt</label>
          <textarea
            id="prompt-input"
            className="textarea"
            placeholder="e.g. Summarize today's top tech news stories..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            disabled={isLoading}
          />

          {voices.length > 0 && (
            <div className="voice-row">
              <label htmlFor="voice-select" className="label">Voice</label>
              <select
                id="voice-select"
                className="select"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                disabled={isLoading}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            className={`btn${isLoading ? ' btn--loading' : ''}`}
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Generating…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Generate Podcast
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {audioUrl && (
          <div className="player-card">
            <p className="player-label">Your podcast is ready</p>
            <audio
              ref={audioRef}
              controls
              onEnded={() => setStatus('idle')}
              className="audio-player"
            >
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
          </div>
        )}
      </main>
    </div>
  )
}
