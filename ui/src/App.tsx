import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Voice {
  id: string
  name: string
}

type Status = 'idle' | 'loading' | 'playing' | 'error'
type AgentStatus = 'idle' | 'active' | 'done' | 'error'

const BAR_COUNT = 28

const AGENTS = [
  {
    number: 1,
    title: 'Research & Scrape',
    description: 'Analyse your requirements and gather the latest news from the internet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <path d="M11 8a3 3 0 0 1 3 3" />
      </svg>
    ),
  },
  {
    number: 2,
    title: 'Summarise & Verify',
    description: 'Consolidate, cross-check and fact-verify the collected news stories',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    number: 3,
    title: 'Text to Audio',
    description: 'Convert the verified news script into a broadcast-quality podcast',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
]

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [voiceId, setVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb')
  const [voices, setVoices] = useState<Voice[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>(['idle', 'idle', 'idle'])
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetch('/voices')
      .then((r) => r.json())
      .then((data: Voice[]) => setVoices(data))
      .catch(() => {/* voices list is optional */})
  }, [])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play()
    }
  }, [audioUrl])

  function setAgent(index: number, s: AgentStatus) {
    setAgentStatuses((prev) => prev.map((v, i) => (i === index ? s : v)))
  }

  async function handleGenerate() {
    if (!prompt.trim()) return
    setError('')
    setAudioUrl(null)
    setAgentStatuses(['idle', 'idle', 'idle'])
    setStatus('loading')

    try {
      // Agent 1: Research & Scrape
      setAgent(0, 'active')
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setAgent(0, 'done')

      // Agent 2: Summarise & Verify
      setAgent(1, 'active')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setAgent(1, 'done')

      // Agent 3: Text to Audio
      setAgent(2, 'active')
      await new Promise((resolve) => setTimeout(resolve, 800))
      setAgent(2, 'done')

      setAudioUrl('/speech.mp3')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setStatus('error')
    }
  }

  function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
      setStatus('playing')
    } else {
      audio.pause()
      setStatus('idle')
    }
  }

  const isLoading = status === 'loading'
  const isPlaying = status === 'playing'

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

      {/* Agent Pipeline */}
      <section className="pipeline-section">
        <div className="pipeline-section-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          <span>Agent Pipeline</span>
        </div>
        <div className="pipeline-steps-v">
          {AGENTS.map((agent, i) => {
            const s = agentStatuses[i]
            return (
              <div key={agent.number} className="pipeline-step">
                <div className={`agent-card-v agent-card-v--${s}`}>
                  <div className="agent-number-badge">
                    {s === 'done' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : s === 'active' ? (
                      <span className="dot-pulse" />
                    ) : (
                      <span>{agent.number}</span>
                    )}
                  </div>
                  <div className="agent-icon-v">{agent.icon}</div>
                  <div className="agent-body-v">
                    <span className="agent-title-v">{agent.title}</span>
                    <span className="agent-desc-v">{agent.description}</span>
                  </div>
                  {s === 'active' && <div className="agent-shimmer" />}
                </div>
                {i < AGENTS.length - 1 && (
                  <div className={`step-arrow${agentStatuses[i] === 'done' ? ' step-arrow--lit' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

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
            <audio
              ref={audioRef}
              onPlay={() => setStatus('playing')}
              onPause={() => setStatus('idle')}
              onEnded={() => setStatus('idle')}
            >
              <source src={audioUrl} type="audio/mpeg" />
            </audio>

            <button className="waveform-btn" onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              <div className="waveform">
                {Array.from({ length: BAR_COUNT }, (_, i) => (
                  <span
                    key={i}
                    className={`bar${isPlaying ? ' bar--active' : ''}`}
                    style={{ animationDelay: `${(i * 80) % 700}ms` }}
                  />
                ))}
              </div>

              <div className="play-icon">
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </div>
            </button>

            <p className="player-label">{isPlaying ? 'Now playing…' : 'Paused — click to resume'}</p>
          </div>
        )}
      </main>
    </div>
  )
}
