import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type User = {
  sub: string
  email: string
  name: string
  picture?: string | null
}

type Message = {
  role: 'user' | 'assistant'
  text: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'
const STORAGE_KEY = 'aaradhya-auth-token'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLoggedIn = useMemo(() => Boolean(token && user), [token, user])

  useEffect(() => {
    if (!token) return

    const loadMe = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) throw new Error('Session expired')
        const data = await response.json()
        setUser(data.user)
      } catch (err) {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setUser(null)
        setError(err instanceof Error ? err.message : 'Failed to restore session')
      }
    }

    void loadMe()
  }, [token])

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      setError(null)
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Google sign-in failed')

      localStorage.setItem(STORAGE_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    }
  }

  const handleLogout = () => {
    googleLogout()
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
    setMessages([])
    setError(null)
  }

  const sendMessage = async () => {
    const message = draft.trim()
    if (!message || !token || busy) return

    setDraft('')
    setBusy(true)
    setError(null)
    setMessages((current) => [...current, { role: 'user', text: message }])

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.error || 'Chat failed')

      setMessages((current) => [...current, { role: 'assistant', text: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="header-row">
          <div>
            <p className="eyebrow">Google-auth OpenClaw web chat</p>
            <h1>Aaradhya</h1>
            <p className="subtle">
              Frontend for GitHub Pages. Backend for your laptop. Replies from local OpenClaw.
            </p>
          </div>
          {isLoggedIn && (
            <button className="ghost-button" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>

        {!isLoggedIn ? (
          <div className="login-card">
            <p>Sign in with Google to enter the chat.</p>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in was cancelled')} />
          </div>
        ) : (
          <>
            <div className="user-pill">
              {user?.picture ? <img src={user.picture} alt={user.name} /> : <span>{user?.name?.[0] || 'U'}</span>}
              <div>
                <strong>{user?.name}</strong>
                <div>{user?.email}</div>
              </div>
            </div>

            <div className="chat-log">
              {messages.length === 0 ? (
                <div className="empty-state">
                  Try: <code>hello</code>
                </div>
              ) : (
                messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
                    <label>{message.role === 'user' ? 'You' : 'OpenClaw'}</label>
                    <p>{message.text}</p>
                  </article>
                ))
              )}
              {busy && <div className="empty-state">Waiting for local OpenClaw…</div>}
            </div>

            <div className="composer">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Send a message to your local OpenClaw"
                rows={3}
              />
              <button className="send-button" onClick={() => void sendMessage()} disabled={busy || !draft.trim()}>
                Send
              </button>
            </div>
          </>
        )}

        {error && <div className="error-banner">{error}</div>}
      </section>
    </main>
  )
}

export default App
