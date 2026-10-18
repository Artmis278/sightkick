import { useEffect, useRef, useState } from 'react'
import './App.css'

function ScreenIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
}

function App() {
  const [stream, setStream] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [isAsking, setIsAsking] = useState(false)
  const [chatError, setChatError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const messagesEndRef = useRef(null)
  const requestRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    requestRef.current?.abort()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, isAsking, chatError])

  function stopSharing() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
  }

  async function shareScreen() {
    setError('')
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is unavailable. Use a supported desktop browser on HTTPS or localhost.')
      return
    }
    setIsSelecting(true)
    try {
      const selectedStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      streamRef.current = selectedStream
      setStream(selectedStream)
      selectedStream.getVideoTracks()[0].addEventListener('ended', stopSharing, { once: true })
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        setError('Unable to share your screen. Check browser permissions and try again.')
      }
    } finally {
      setIsSelecting(false)
    }
  }

  async function sendQuestion(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || requestRef.current) return
    setChatError('')
    const track = streamRef.current?.getVideoTracks()[0]
    const video = videoRef.current
    if (!track || track.readyState !== 'live') {
      setChatError('Share a screen or window before asking a question.')
      return
    }
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setChatError('Your screen preview is not ready yet. Wait a moment and try again.')
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setIsAsking(true)
    const timeout = setTimeout(() => controller.abort(), 75_000)
    try {
      // Capture only on submit; the original sharing stream keeps running.
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Unable to capture your screen. Please try sharing again.')
      context.drawImage(video, 0, 0)
      const screenshot = canvas.toDataURL('image/jpeg', 0.85)
      setMessages((current) => [...current, { role: 'user', text }])
      setQuestion('')

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, screenshot }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string'
          ? data.error
          : 'The assistant is unavailable. Check that the backend is running and try again.')
      }
      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error('The assistant returned an empty response. Please try again.')
      }
      setMessages((current) => [...current, { role: 'assistant', text: data.answer }])
    } catch (err) {
      setChatError(err.name === 'AbortError'
        ? 'The request timed out. Please try again.'
        : err instanceof TypeError
          ? 'Could not reach the assistant. Check your connection and that the backend is running.'
          : err.message || 'Something went wrong. Please try again.')
      setQuestion((current) => current || text)
    } finally {
      clearTimeout(timeout)
      requestRef.current = null
      setIsAsking(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./"><span className="brand-mark"><ScreenIcon /></span><span>Sightkick</span></a>
        <span className="version-badge">EARLY PREVIEW</span>
      </header>
      <main>
        <div className="intro"><div className="eyebrow"><span />YOUR ON-DEMAND SCREEN ASSISTANT</div><h1>A little clarity.<br className="mobile-break" /> For anything on your screen.</h1><p>Share what you’re looking at. Ask what’s on your mind.</p></div>
        <div className="workspace">
          <section className="screen-panel panel" aria-labelledby="screen-heading">
            <div className="panel-header"><div className="panel-title"><ScreenIcon /><h2 id="screen-heading">Your screen</h2></div><span className={`status ${stream ? 'is-live' : ''}`}><span />{stream ? 'Live preview' : 'Not sharing'}</span></div>
            <div className={`preview ${stream ? 'has-stream' : ''}`}>
              {stream ? <video ref={videoRef} autoPlay playsInline muted aria-label="Live preview of your shared screen" /> : <div className="preview-empty"><div className="screen-illustration"><ScreenIcon /><span className="sparkle">✦</span></div><h3>Bring your screen into the conversation</h3><p>Choose a tab, window, or your entire screen.<br />You’re always in control of what you share.</p><button className="primary-button" onClick={shareScreen} disabled={isSelecting}><ScreenIcon />{isSelecting ? 'Choose a screen…' : 'Share Screen'}</button><span className="preview-hint">Your browser will ask what you’d like to share</span></div>}
            </div>
            <div className="screen-footer"><span className="privacy-note">◇ Preview stays in your browser</span><button className="stop-button" onClick={stopSharing} disabled={!stream}><span />Stop Sharing</button></div>
            {error && <p className="error-message" role="alert">{error}</p>}
          </section>
          <section className="chat-panel panel" aria-labelledby="chat-heading">
            <div className="panel-header"><div className="panel-title"><span className="assistant-icon">✦</span><h2 id="chat-heading">Assistant</h2></div><span className="frontend-badge">On demand</span></div>
            <div className="chat-content" role="log" aria-live="polite" aria-label="Conversation">
              {messages.length === 0 ? <div className="chat-empty"><div className="assistant-orb">✦</div><h3>A fresh perspective starts here.</h3><p>Ask a question about anything on your screen.</p><div className="suggestions"><span>TRY A QUESTION</span>{['What am I looking at?', 'Help me understand this', 'What should I do next?'].map((text) => <button key={text} onClick={() => setQuestion(text)}>{text}<span aria-hidden="true">↗</span></button>)}</div></div> : messages.map((message, index) => <div className={`message ${message.role}`} key={index}><span className="message-author">{message.role === 'user' ? 'You' : 'Sightkick'}</span><p>{message.text}</p></div>)}
              {isAsking && <div className="message assistant loading-message" role="status"><span className="message-author">Sightkick</span><p><span className="loading-dot" aria-hidden="true" />Looking at your screenshot…</p></div>}
              {chatError && <p className="chat-error" role="alert">{chatError}</p>}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-form" onSubmit={sendQuestion}><label className="sr-only" htmlFor="question">Ask a question</label><div className="input-row"><input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your screen…" autoComplete="off" maxLength={10000} /><button type="submit" disabled={!question.trim() || isAsking}>{isAsking ? 'Sending…' : 'Send'} <span aria-hidden="true">↑</span></button></div><p><span />One screenshot sent per question</p></form>
          </section>
        </div>
        <footer className="page-footer"><span>A clearer view, one question at a time.</span><span>Screenshots sent only when you ask. No recording.</span></footer>
      </main>
    </div>
  )
}

export default App
