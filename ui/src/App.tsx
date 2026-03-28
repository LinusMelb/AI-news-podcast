import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

interface Voice {
  id: string
  name: string
}

interface FeedSource {
  id: string
  name: string
}

interface NewsItem {
  id?: string
  title: string
  summary?: string
  source?: string
  publishedAt?: string
  url?: string
}

interface NewsFeedResponse {
  sources: FeedSource[]
  items: NewsItem[]
}

interface PodcastScriptResponse {
  script: string
}

type Status = 'idle' | 'loading' | 'playing' | 'error'
type FeedStatus = 'idle' | 'loading' | 'ready' | 'error'

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'
const DEFAULT_TOPIC = 'Big tech news roundup'
const DEFAULT_LOCALE = 'en-US'
const DEFAULT_DURATION = 45
const FEED_LIMIT = 18

function getStoryId(item: NewsItem): string {
  return item.id ?? item.url ?? item.title
}

function formatPublishedAt(value?: string): string {
  if (!value) return 'Fresh from the wire'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default function App() {
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID)
  const [voices] = useState<Voice[]>([])
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('idle')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [feedSources, setFeedSources] = useState<FeedSource[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [topic, setTopic] = useState(DEFAULT_TOPIC)
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION)
  const [script, setScript] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const previousAudioUrl = useRef<string | null>(null)

  // useEffect(() => {
  //   fetch('/voices')
  //     .then(async (response) => {
  //       if (!response.ok) {
  //         throw new Error('Unable to load voices')
  //       }

  //       return response.json() as Promise<Voice[]>
  //     })
  //     .then((data) => setVoices(data))
  //     .catch(() => {
  //       // Voice selection is helpful but not required for the rest of the app.
  //     })
  // }, [])

  useEffect(() => {
    void loadFeeds()
  }, [])

  useEffect(() => {
    if (!audioUrl || !audioRef.current) {
      return
    }

    if (previousAudioUrl.current) {
      URL.revokeObjectURL(previousAudioUrl.current)
    }

    previousAudioUrl.current = audioUrl
    audioRef.current.load()
    void audioRef.current.play()
    setStatus('playing')
  }, [audioUrl])

  useEffect(() => {
    return () => {
      if (previousAudioUrl.current) {
        URL.revokeObjectURL(previousAudioUrl.current)
      }
    }
  }, [])

  const selectedStories = useMemo(
    () => newsItems.filter((item) => selectedIds.includes(getStoryId(item))),
    [newsItems, selectedIds],
  )

  async function loadFeeds() {
    setFeedStatus('loading')
    setError('')

    try {
      const response = await fetch(`/news-feed?limit=${FEED_LIMIT}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Unable to fetch news feeds')
      }

      const data = (await response.json()) as NewsFeedResponse
      setNewsItems(data.items)
      setFeedSources(data.sources)
      setSelectedIds(data.items.slice(0, 4).map((item) => getStoryId(item)))
      setFeedStatus('ready')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to fetch tech headlines'
      setError(message)
      setFeedStatus('error')
    }
  }

  function toggleStory(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    )
  }

  async function handleGenerateBriefing() {
    if (selectedStories.length === 0) {
      setError('Pick at least one story before generating a briefing.')
      return
    }

    setError('')
    setStatus('loading')
    setAudioUrl(null)
    setScript('')

    try {
      const scriptResponse = await fetch('/podcast-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || DEFAULT_TOPIC,
          locale,
          durationSeconds,
          news: selectedStories,
        }),
      })

      if (!scriptResponse.ok) {
        const body = await scriptResponse.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Unable to write the podcast script')
      }

      const scriptBody = (await scriptResponse.json()) as PodcastScriptResponse
      setScript(scriptBody.script)

      const audioResponse = await fetch('/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptBody.script, voice_id: voiceId }),
      })

      if (!audioResponse.ok) {
        const body = await audioResponse.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Unable to generate audio')
      }

      const blob = await audioResponse.blob()
      setAudioUrl(URL.createObjectURL(blob))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setStatus('error')
    }
  }

  const isGenerating = status === 'loading'
  const canGenerate = !isGenerating && selectedStories.length > 0 && feedStatus !== 'loading'

  return (
    <div className="page-shell">
      <div className="news-glow news-glow--left" />
      <div className="news-glow news-glow--right" />

      <div className="container">
        {/* <header className="hero">
          <p className="eyebrow">Big Tech Wire</p>
          <h2>Turn live tech headlines into an audio briefing.</h2>
          <p className="subtitle">
            Pull stories from major tech outlets, pick the ones you want, and generate a spoken roundup in one pass.
          </p>

          <div className="hero-meta">
            <div>
              <span className="meta-label">Sources</span>
              <strong>{feedSources.length || 5} outlets tracked</strong>
            </div>
            <div>
              <span className="meta-label">Selection</span>
              <strong>{selectedStories.length} stories in briefing</strong>
            </div>
          </div>
        </header> */}

        <main className="layout">
          <section className="panel panel--control">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Studio</p>
                <h2>Build your briefing</h2>
              </div>
              <button className="ghost-button" onClick={() => void loadFeeds()} disabled={feedStatus === 'loading'}>
                {feedStatus === 'loading' ? 'Refreshing...' : 'Refresh feed'}
              </button>
            </div>

            <div className="control-grid">
              <label className="field">
                <span className="label">Briefing topic</span>
                <input
                  className="input"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  disabled={isGenerating}
                />
              </label>

              <label className="field">
                <span className="label">Language</span>
                <input
                  className="input"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  disabled={isGenerating}
                />
              </label>

              <label className="field">
                <span className="label">Approx. duration</span>
                <select
                  className="select"
                  value={durationSeconds}
                  onChange={(event) => setDurationSeconds(Number(event.target.value))}
                  disabled={isGenerating}
                >
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                  <option value={60}>60 seconds</option>
                  <option value={90}>90 seconds</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Voice</span>
                <select
                  className="select"
                  value={voiceId}
                  onChange={(event) => setVoiceId(event.target.value)}
                  disabled={isGenerating || voices.length === 0}
                >
                  {voices.length > 0 ? (
                    voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))
                  ) : (
                    <option value={DEFAULT_VOICE_ID}>Default voice</option>
                  )}
                </select>
              </label>
            </div>

            <button className={`primary-button${isGenerating ? ' primary-button--loading' : ''}`} onClick={handleGenerateBriefing} disabled={!canGenerate}>
              {isGenerating ? 'Writing and voicing briefing...' : 'Generate podcast briefing'}
            </button>
          </section>

          <section className="panel panel--feed">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Headlines</p>
                <h2>Big tech feeds</h2>
              </div>
              <p className="helper-text">Choose the stories you want to include.</p>
            </div>

            <div className="sources-row">
              {feedSources.map((source) => (
                <span key={source.id} className="source-pill">
                  {source.name}
                </span>
              ))}
            </div>

            <div className="story-list">
              {newsItems.map((item) => {
                const itemId = getStoryId(item)
                const checked = selectedIds.includes(itemId)

                return (
                  <label key={itemId} className={`story-card${checked ? ' story-card--selected' : ''}`}>
                    <input
                      className="story-checkbox"
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStory(itemId)}
                      disabled={isGenerating}
                    />
                    <div className="story-copy">
                      <div className="story-meta">
                        <span>{item.source ?? 'Tech news'}</span>
                        <span>{formatPublishedAt(item.publishedAt)}</span>
                      </div>
                      <h3>{item.title}</h3>
                      {item.summary && <p>{item.summary}</p>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" className="story-link">
                          Read source
                        </a>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="panel panel--output">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Output</p>
                <h2>Script and playback</h2>
              </div>
            </div>

            {script ? (
              <div className="script-card">
                <p className="script-label">Generated script</p>
                <p className="script-body">{script}</p>
              </div>
            ) : (
              <div className="empty-state">
                Generate a briefing to preview the script and audio here.
              </div>
            )}

            {audioUrl && (
              <div className="player-card">
                <audio ref={audioRef} onEnded={() => setStatus('idle')} style={{ display: 'none' }}>
                  <source src={audioUrl} type="audio/mpeg" />
                </audio>
                <div className="waveform-row">
                  <div className={`waveform${status === 'playing' ? ' waveform--playing' : ''}`}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <span key={i} className="waveform-bar" style={{ animationDelay: `${(i * 0.07) % 0.8}s` }} />
                    ))}
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      if (!audioRef.current) return
                      if (status === 'playing') {
                        audioRef.current.pause()
                        setStatus('idle')
                      } else {
                        void audioRef.current.play()
                        setStatus('playing')
                      }
                    }}
                  >
                    {status === 'playing' ? 'Pause' : 'Play'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  )
}
