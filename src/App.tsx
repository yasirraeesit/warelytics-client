import { useEffect, useMemo, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { apiFetch, API_URL } from './api/client'
import type { LoginResponse } from './api/types'
import { getToken, setToken } from './auth/session'
import { WarehousesPage } from './pages/MasterData/WarehousesPage'
import { ZonesPage } from './pages/MasterData/ZonesPage'
import { PlantsPage } from './pages/MasterData/PlantsPage'

type Tab = 'warehouses' | 'zones' | 'plants'

function App() {
  const [count, setCount] = useState(0)
  const [apiStatus, setApiStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [tab, setTab] = useState<Tab>('warehouses')

  const isAuthed = useMemo(() => Boolean(token), [token])

  useEffect(() => {
    let cancelled = false
    apiFetch<string>('/')
      .then(() => !cancelled && setApiStatus('ok'))
      .catch(() => !cancelled && setApiStatus('error'))
    return () => {
      cancelled = true
    }
  }, [])

  async function login(email: string, password: string) {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      json: { email, password },
    })
    setToken(res.accessToken)
    setTokenState(res.accessToken)
  }

  function logout() {
    setToken(null)
    setTokenState(null)
  }

  return (
    <>
      <header className="topbar">
        <div className="row spaceBetween">
          <div className="row">
            <strong>Warelytics Admin</strong>
            <span className="muted">
              API <code>{API_URL}</code> — <strong>{apiStatus === 'idle' ? 'checking…' : apiStatus}</strong>
            </span>
          </div>
          <div className="row">
            {isAuthed ? (
              <>
                <span className="muted">
                  Auth: <code>on</code>
                </span>
                <button type="button" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <LoginInline onLogin={login} />
            )}
          </div>
        </div>
        <nav className="tabs">
          <button
            type="button"
            className={tab === 'warehouses' ? 'active' : ''}
            onClick={() => setTab('warehouses')}
          >
            Warehouses
          </button>
          <button type="button" className={tab === 'zones' ? 'active' : ''} onClick={() => setTab('zones')}>
            Zones
          </button>
          <button type="button" className={tab === 'plants' ? 'active' : ''} onClick={() => setTab('plants')}>
            Plants
          </button>
        </nav>
      </header>

      {isAuthed ? (
        <main className="main">
          {tab === 'warehouses' ? <WarehousesPage token={token!} /> : null}
          {tab === 'zones' ? <ZonesPage token={token!} /> : null}
          {tab === 'plants' ? <PlantsPage token={token!} /> : null}
        </main>
      ) : (
        <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Warelytics Admin</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
          <p className="muted">
            Login to manage master data (Warehouses/Zones/Plants).
          </p>
          <div className="card">
            <LoginInline
              onLogin={login}
              defaultEmail="admin@warelytics.local"
              defaultPassword="Password123!"
            />
          </div>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>
      )}

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App

function LoginInline({
  onLogin,
  defaultEmail = '',
  defaultPassword = '',
}: {
  onLogin: (email: string, password: string) => Promise<void>
  defaultEmail?: string
  defaultPassword?: string
}) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState(defaultPassword)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      await onLogin(email, password)
    } catch (e: any) {
      setError(e?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="row">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
      />
      <button type="button" onClick={submit} disabled={!email.trim() || !password || loading}>
        {loading ? 'Logging in…' : 'Login'}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  )
}
