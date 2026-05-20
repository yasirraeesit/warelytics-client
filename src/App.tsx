import { useEffect, useMemo, useState } from 'react'
import { apiFetch, API_URL } from './api/client'
import type { ListResponse, LoginResponse, User, Warehouse } from './api/types'
import { getToken, setToken } from './auth/session'
import { WarehousesPage } from './pages/MasterData/WarehousesPage'
import { ZonesPage } from './pages/MasterData/ZonesPage'
import { PlantsPage } from './pages/MasterData/PlantsPage'
import { ProductsPage } from './pages/Products/ProductsPage'
import { ScanLogsPage } from './pages/Scans/ScanLogsPage'
import { InventoryMovementsPage } from './pages/Movements/InventoryMovementsPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'

type Tab = 'dashboard' | 'warehouses' | 'zones' | 'plants' | 'products' | 'scans' | 'movements'
type Theme = 'dark' | 'light'

const THEME_KEY = 'warelytics.theme'
const SIDEBAR_KEY = 'warelytics.sidebarCollapsed'
const TAB_KEY = 'warelytics.lastTab'
const WAREHOUSE_KEY = 'warelytics.warehouseId'
const IS_DEV = import.meta.env.DEV

type GlobalSearchScope = 'products' | 'zones' | 'scans' | 'movements'

function getUrlParam(key: string) {
  try {
    return new URL(window.location.href).searchParams.get(key) ?? ''
  } catch {
    return ''
  }
}

function updateUrlParams(next: Record<string, string | null | undefined>) {
  try {
    const url = new URL(window.location.href)
    for (const [k, v] of Object.entries(next)) {
      if (!v) url.searchParams.delete(k)
      else url.searchParams.set(k, v)
    }
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`)
  } catch {
    // ignore
  }
}

function parseTabFromHash(hash: string): Tab | null {
  const raw = hash.replace(/^#/, '').trim().toLowerCase()
  if (!raw) return null
  const allowed: Tab[] = ['dashboard', 'warehouses', 'zones', 'plants', 'products', 'scans', 'movements']
  return (allowed as string[]).includes(raw) ? (raw as Tab) : null
}

function App() {
  const [apiStatus, setApiStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const fromHash = parseTabFromHash(window.location.hash)
    if (fromHash) return fromHash
    const saved = localStorage.getItem(TAB_KEY) as Tab | null
    if (saved && parseTabFromHash(`#${saved}`)) return saved
    return 'dashboard'
  })
  const [navSearch, setNavSearch] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState<string>(() => localStorage.getItem(WAREHOUSE_KEY) ?? getUrlParam('warehouseId'))
  const [globalSearchScope, setGlobalSearchScope] = useState<GlobalSearchScope>('products')
  const [globalSearchValue, setGlobalSearchValue] = useState('')
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY)
    return saved === '1'
  })

  const isAuthed = useMemo(() => Boolean(token), [token])

  const currentWarehouseLabel = useMemo(() => {
    if (!warehouseId) return 'All warehouses'
    const w = warehouses.find((x) => x.id === warehouseId)
    if (!w) return 'Warehouse'
    return `${w.code} — ${w.name}`
  }, [warehouses, warehouseId])

  const pageTitle = useMemo(() => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard'
      case 'warehouses':
        return 'Warehouses'
      case 'zones':
        return 'Zones'
      case 'plants':
        return 'Plants'
      case 'products':
        return 'Products'
      case 'scans':
        return 'Scan Logs'
      case 'movements':
        return 'Inventory Movements'
      default:
        return 'Dashboard'
    }
  }, [tab])

  const navItems = useMemo(
    () =>
      [
        { id: 'dashboard' as const, label: 'Dashboard', icon: DashboardIcon },
        { id: 'warehouses' as const, label: 'Warehouses', icon: WarehouseIcon },
        { id: 'zones' as const, label: 'Zones', icon: ZoneIcon },
        { id: 'plants' as const, label: 'Plants', icon: PlantIcon },
        { id: 'products' as const, label: 'Products', icon: ProductIcon },
        { id: 'scans' as const, label: 'Scan Logs', icon: ScanIcon },
        { id: 'movements' as const, label: 'Movements', icon: MovementIcon },
      ].filter((i) => i.label.toLowerCase().includes(navSearch.trim().toLowerCase())),
    [navSearch],
  )

  const navSections = useMemo(() => {
    const itemsById = new Map(navItems.map((i) => [i.id, i]))
    const get = (id: Tab) => itemsById.get(id)
    return [
      {
        title: 'Overview',
        items: [get('dashboard')].filter(Boolean) as typeof navItems,
      },
      {
        title: 'Master Data',
        items: [get('warehouses'), get('zones'), get('plants'), get('products')].filter(Boolean) as typeof navItems,
      },
      {
        title: 'Operations',
        items: [get('scans'), get('movements')].filter(Boolean) as typeof navItems,
      },
    ].filter((s) => s.items.length > 0)
  }, [navItems])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(WAREHOUSE_KEY, warehouseId)
    updateUrlParams({ warehouseId })
  }, [warehouseId])

  useEffect(() => {
    // keep URL and localStorage in sync for reload/deep links
    localStorage.setItem(TAB_KEY, tab)
    const nextHash = `#${tab}`
    if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash)
  }, [tab])

  useEffect(() => {
    function onHashChange() {
      const next = parseTabFromHash(window.location.hash)
      if (next) setTab(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    let cancelled = false
    apiFetch<string>('/')
      .then(() => !cancelled && setApiStatus('ok'))
      .catch(() => !cancelled && setApiStatus('error'))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarehouses([])
      return
    }
    let cancelled = false
    apiFetch<ListResponse<Warehouse>>('/warehouses?skip=0&take=200', { token })
      .then((res) => {
        if (cancelled) return
        setWarehouses(res.items ?? [])
        const hasSelected = (res.items ?? []).some((w) => w.id === warehouseId)
        if (!warehouseId && res.items?.[0]?.id) setWarehouseId(res.items[0].id)
        else if (warehouseId && !hasSelected) setWarehouseId('')
      })
      .catch(() => {
        if (cancelled) return
        setWarehouses([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(null)
      return
    }
    let cancelled = false
    apiFetch<User>('/auth/me', { token })
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && setUser(null))
    return () => {
      cancelled = true
    }
  }, [token])

  async function login(email: string, password: string) {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      json: { email, password },
    })
    setToken(res.accessToken)
    setTokenState(res.accessToken)
    setUser(res.user as unknown as User)
  }

  function logout() {
    setToken(null)
    setTokenState(null)
    setUser(null)
  }

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  function toggleSidebar() {
    setSidebarCollapsed((v) => !v)
  }

  function navigate(next: Tab) {
    setTab(next)
  }

  function openProductsCreate() {
    setTab('products')
    updateUrlParams({ create: '1' })
  }

  function runGlobalSearch() {
    const q = globalSearchValue.trim()
    if (!q) return
    setTab(globalSearchScope)
    updateUrlParams({ q, warehouseId, create: null })
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-black/30">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-none items-center gap-3">
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-transparent px-2 py-2 text-left hover:border-white/10 hover:bg-white/5"
              onClick={() => navigate('dashboard')}
              title="Go to dashboard"
            >
              <div
                className="h-[10px] w-[10px] rounded-full shadow-[0_0_0_3px_rgba(124,58,237,0.18)]"
                style={{
                  background:
                    'radial-gradient(circle at 30% 30%, rgba(124,58,237,1), rgba(16,185,129,0.95))',
                }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="font-extrabold tracking-wide">Warelytics</div>
                <div className="text-sm text-white/70">Operations dashboard</div>
              </div>
            </button>

            {isAuthed ? (
              <label className="hidden min-w-0 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 hover:border-white/25 lg:flex">
                <span className="text-sm text-white/70">WH</span>
                <select
                  className="min-w-0 max-w-[240px] truncate bg-transparent text-sm font-semibold outline-none"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  title={currentWarehouseLabel}
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="min-w-[260px] basis-full flex-1 lg:basis-auto" aria-label="Global search">
            {isAuthed ? (
              <div className="min-w-0">
                <div className="hidden items-baseline justify-between px-2 pb-1 xl:flex">
                  <div className="truncate text-sm font-semibold text-white/85">{pageTitle}</div>
                  <div className="truncate text-sm text-white/60">{currentWarehouseLabel}</div>
                </div>
                <form
                  className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 p-2 hover:border-white/25"
                  onSubmit={(e) => {
                    e.preventDefault()
                    runGlobalSearch()
                  }}
                >
                  <select
                    className="h-9 rounded-xl border border-white/10 bg-black/10 px-2 text-sm font-semibold outline-none focus:border-purple-500/60"
                    value={globalSearchScope}
                    onChange={(e) => setGlobalSearchScope(e.target.value as GlobalSearchScope)}
                    aria-label="Search scope"
                    title="Search scope"
                  >
                    <option value="products" title="Inventory">
                      Inv
                    </option>
                    <option value="zones" title="Locations">
                      Loc
                    </option>
                    <option value="scans" title="Scan logs">
                      Scans
                    </option>
                    <option value="movements" title="Movements">
                      Moves
                    </option>
                  </select>
                  <div className="relative min-w-0 flex-1">
                    <input
                      className="h-9 w-full rounded-xl border border-white/10 bg-black/10 pl-9 pr-3 text-sm outline-none focus:border-purple-500/60"
                      value={globalSearchValue}
                      onChange={(e) => setGlobalSearchValue(e.target.value)}
                      placeholder="Search SKU, QR, code…"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
                      <SearchIcon />
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:border-white/25 sm:inline-flex"
                    title="Search (Enter)"
                    aria-label="Search"
                  >
                    <SearchIcon />
                  </button>
                </form>
              </div>
            ) : (
              <div className="hidden min-w-0 text-center md:block" aria-label="Current page">
                <div className="truncate text-[1.1rem] font-extrabold tracking-wide">Sign in</div>
                <div className="text-sm text-white/70">Tenant portal access</div>
              </div>
            )}
          </div>

          <div className="ml-auto flex flex-none items-center gap-2">
              {isAuthed ? (
                <>
                  <button
                    type="button"
                    className="hidden h-10 items-center gap-2 rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 text-sm font-semibold hover:border-purple-500/75 md:inline-flex"
                    onClick={() => navigate('scans')}
                    title="Go to scan logs"
                  >
                    <ScanIcon /> Scan
                  </button>
                  <button
                    type="button"
                    className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold hover:border-white/25 md:inline-flex"
                    onClick={openProductsCreate}
                    title="Create new item"
                  >
                    <PlusIcon /> New item
                  </button>
                </>
              ) : null}

              {IS_DEV ? (
                <details className="relative hidden md:block">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:border-white/20">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background:
                          apiStatus === 'ok'
                            ? 'rgba(16,185,129,1)'
                            : apiStatus === 'error'
                              ? 'rgba(239,68,68,1)'
                              : 'rgba(245,158,11,1)',
                      }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold">API</span>
                  </summary>
                  <div className="absolute right-0 top-[calc(100%+10px)] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/15 bg-black/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
                    <div className="flex items-center justify-between gap-3 py-2">
                      <div className="text-sm text-white/70">URL</div>
                      <div className="max-w-[240px] truncate text-right">
                        <code>{API_URL}</code>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2">
                      <div className="text-sm text-white/70">Status</div>
                      <div>
                        <code>{apiStatus === 'idle' ? 'checking…' : apiStatus}</code>
                      </div>
                    </div>
                  </div>
                </details>
              ) : null}

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 p-0 hover:border-white/25"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>

                {isAuthed ? (
                  <>
                    <details className="relative">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 hover:border-white/25">
                      <span
                        className="h-[10px] w-[10px] rounded-full shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                        style={{
                          background:
                            'radial-gradient(circle at 30% 30%, rgba(16,185,129,1), rgba(124,58,237,0.9))',
                        }}
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="max-w-[220px] truncate">{user?.name ?? user?.email ?? 'Account'}</span>
                        <span className="text-sm text-white/70">{user?.role ?? ''}</span>
                      </span>
                      <ChevronDownIcon />
                    </summary>
                    <div
                      className="absolute right-0 top-[calc(100%+10px)] w-[min(320px,calc(100vw-24px))] rounded-2xl border border-white/15 bg-black/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur"
                      role="menu"
                    >
                      <div className="flex items-center justify-between gap-3 py-2">
                        <div className="text-sm text-white/70">Signed in as</div>
                        <div>
                          <code>{user?.name ?? ''}</code>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-2">
                        <div className="text-sm text-white/70">Role</div>
                        <div>
                          <code>{user?.role ?? ''}</code>
                        </div>
                      </div>
                      <div className="my-2 h-px bg-white/10" />
                      <button
                        type="button"
                        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-left hover:border-red-500/40"
                        onClick={logout}
                      >
                        Logout
                      </button>
                    </div>
                  </details>
                </>
              ) : (
                <span className="text-white/70">Login to continue</span>
              )}
          </div>
        </div>
      </header>

      {isAuthed ? (
        <main className="mx-auto flex max-w-[1800px] gap-4 px-4 py-4">
          <aside
            className={`sticky top-[74px] self-start transition-[width] duration-200 ease-out ${
              sidebarCollapsed ? 'w-[88px]' : 'w-[300px]'
            }`}
          >
            <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="h-[10px] w-[10px] rounded-full shadow-[0_0_0_3px_rgba(124,58,237,0.18)]"
                    style={{
                      background:
                        'radial-gradient(circle at 30% 30%, rgba(124,58,237,1), rgba(16,185,129,0.95))',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className={`min-w-0 text-base font-extrabold tracking-wide transition-all duration-200 ${
                      sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                    }`}
                  >
                    Warelytics
                  </div>
                </div>
                <button
                  type="button"
                  className="relative z-10 inline-flex h-11 w-11 shrink-0 touch-manipulation select-none items-center justify-center rounded-xl border border-white/15 bg-white/5 p-0 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 active:scale-[0.98]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleSidebar}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed ? <ExpandIcon /> : <CollapseIcon />}
                </button>
              </div>

              <div
                className={`mb-3 overflow-hidden transition-all duration-200 ${
                  sidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-white/75">
                  <SearchIcon />
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
                    value={navSearch}
                    onChange={(e) => setNavSearch(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search navigation"
                  />
                </div>
              </div>

              <nav className="flex flex-col gap-2">
                {navSections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <div
                      className={`overflow-hidden text-xs font-semibold uppercase tracking-wider text-white/60 transition-all duration-200 ${
                        sidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
                      }`}
                    >
                      {section.title}
                    </div>
                    <div className="flex flex-col gap-2">
                      {section.items.map((item) => {
                        const Icon = item.icon
                        const active = tab === item.id
                        return (
                          <div key={item.id} className="group relative">
                            <button
                              type="button"
                              aria-current={active ? 'page' : undefined}
                              className={`relative flex w-full items-center gap-2 rounded-2xl border px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 ${
                                active
                                  ? 'border-purple-500/60 bg-purple-500/15 shadow-[0_10px_26px_rgba(124,58,237,0.15)]'
                                  : 'border-white/10 bg-black/20 hover:border-purple-500/35 hover:bg-purple-500/10'
                              } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                              onClick={() => navigate(item.id)}
                              title={sidebarCollapsed ? item.label : undefined}
                            >
                              {active ? (
                                <span
                                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-purple-400/80"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center text-white/80"
                                aria-hidden="true"
                              >
                                <Icon />
                              </span>
                              <span
                                className={`whitespace-nowrap text-left transition-all duration-200 ${
                                  sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>

                            {sidebarCollapsed ? (
                              <div
                                className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity delay-200 group-hover:opacity-100"
                                aria-hidden="true"
                              >
                                <div className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-sm shadow-lg backdrop-blur">
                                  {item.label}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    <div className="h-px bg-white/10" />
                  </div>
                ))}

                {navItems.length === 0 ? (
                  <div className={`text-sm text-white/70 ${sidebarCollapsed ? 'hidden' : 'block'}`}>No matches.</div>
                ) : null}
              </nav>

              <div className="mt-4 border-t border-white/10 pt-3">
                <div
                  className={`overflow-hidden text-xs text-white/60 transition-all duration-200 ${
                    sidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
                  }`}
                >
                  Logged in as <span className="text-white/80">{user?.email ?? ''}</span>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <div
              key={tab}
              className="animate-content-in rounded-[18px] border border-white/10 bg-white/5 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              {tab === 'dashboard' ? <DashboardPage token={token!} /> : null}
              {tab === 'warehouses' ? <WarehousesPage token={token!} /> : null}
              {tab === 'zones' ? <ZonesPage token={token!} /> : null}
              {tab === 'plants' ? <PlantsPage token={token!} /> : null}
              {tab === 'products' ? <ProductsPage token={token!} role={user?.role ?? null} /> : null}
              {tab === 'scans' ? <ScanLogsPage token={token!} /> : null}
              {tab === 'movements' ? <InventoryMovementsPage token={token!} /> : null}
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-[1100px] px-4 py-6">
          <div className="flex min-h-[calc(100vh-110px)] items-center justify-center">
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 md:max-w-[760px]">
              <div className="mb-3">
                <div className="inline-flex items-center rounded-full border border-purple-500/55 bg-purple-500/15 px-3 py-1 font-semibold">
                  Warelytics
                </div>
                <h1 className="mt-2 text-2xl font-extrabold">Sign in</h1>
                <p className="text-white/70">Tenant portal access (company users).</p>
              </div>
              <LoginInline
                onLogin={login}
                defaultEmail="admin@warelytics.local"
                defaultPassword="Password123!"
              />
              <p className="mt-3 text-sm text-white/70">
                Seeded password: <code>Password123!</code>
              </p>
              {apiStatus === 'error' ? (
                <p className="mt-2 text-sm text-red-400">
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 11.5C3 10.6716 3.67157 10 4.5 10H6.5C7.32843 10 8 10.6716 8 11.5V15.5C8 16.3284 7.32843 17 6.5 17H4.5C3.67157 17 3 16.3284 3 15.5V11.5Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M12 4.5C12 3.67157 12.6716 3 13.5 3H15.5C16.3284 3 17 3.67157 17 4.5V15.5C17 16.3284 16.3284 17 15.5 17H13.5C12.6716 17 12 16.3284 12 15.5V4.5Z"
        fill="currentColor"
        opacity="0.65"
      />
      <path
        d="M7.5 6C7.5 5.17157 8.17157 4.5 9 4.5H11C11.8284 4.5 12.5 5.17157 12.5 6V15.5C12.5 16.3284 11.8284 17 11 17H9C8.17157 17 7.5 16.3284 7.5 15.5V6Z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  )
}

function WarehouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10V7.5a1 1 0 0 1 .6-.92l7-3a1 1 0 0 1 .8 0l7 3a1 1 0 0 1 .6.92V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 10h16v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 14h3v6H8v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function ZoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7a2 2 0 0 1 2-2h6v6H4V7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 5h4a2 2 0 0 1 2 2v4h-6V5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 13h6v6H6a2 2 0 0 1-2-2v-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 13h6v4a2 2 0 0 1-2 2h-4v-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlantIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21c0-6 0-10 7-14-1 7-4 10-7 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 21c0-6 0-10-7-14 1 7 4 10 7 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 21V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ProductIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7h10l-1 13H8L7 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 7a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7V5a1 1 0 0 1 1-1h2M20 7V5a1 1 0 0 0-1-1h-2M4 17v2a1 1 0 0 0 1 1h2M20 17v2a1 1 0 0 1-1 1h-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MovementIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9 9 7 7l2-2M15 15l2 2-2 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}


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
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="min-w-[220px] flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white/90 outline-none focus:border-purple-500/60"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        className="min-w-[220px] flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white/90 outline-none focus:border-purple-500/60"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
      />
      <button
        type="button"
        className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
        onClick={submit}
        disabled={!email.trim() || !password || loading}
      >
        {loading ? 'Logging in…' : 'Login'}
      </button>
      {error ? <span className="text-red-400">{error}</span> : null}
    </div>
  )
}
