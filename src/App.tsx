import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { apiFetch, API_URL } from './api/client'
import type { LoginResponse } from './api/types'
import { getToken, setToken } from './auth/session'
import { WarehousesPage } from './pages/MasterData/WarehousesPage'
import { ZonesPage } from './pages/MasterData/ZonesPage'
import { PlantsPage } from './pages/MasterData/PlantsPage'

type Tab = 'warehouses' | 'zones' | 'plants'

function App() {
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
              <span className="muted">Login to continue</span>
            )}
          </div>
        </div>
        {isAuthed ? (
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
        ) : null}
      </header>

      {isAuthed ? (
        <main className="main">
          {tab === 'warehouses' ? <WarehousesPage token={token!} /> : null}
          {tab === 'zones' ? <ZonesPage token={token!} /> : null}
          {tab === 'plants' ? <PlantsPage token={token!} /> : null}
        </main>
      ) : (
        <main className="main">
          <div className="loginWrap">
            <div className="loginCard">
              <div className="loginHeader">
                <div className="badge">Warelytics</div>
                <h1 className="loginTitle">Sign in</h1>
                <p className="muted">Use the seeded admin to access Warehouses/Zones/Plants.</p>
              </div>
              <LoginInline
                onLogin={login}
                defaultEmail="admin@warelytics.local"
                defaultPassword="Password123!"
              />
              <p className="muted small">
                Seeded password: <code>Password123!</code>
              </p>
              {apiStatus === 'error' ? (
                <p className="error small">
                  API check failed. Confirm backend is running on <code>{API_URL}</code>.
                </p>
              ) : null}
            </div>
          </div>
        </main>
      )}
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
