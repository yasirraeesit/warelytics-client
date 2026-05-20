import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../api/client';
import type {
  AnalyticsInvalidLeadersResponse,
  AnalyticsMovementsTypeShareResponse,
  AnalyticsScansStatusShareResponse,
  AnalyticsScansTrendResponse,
  AnalyticsStockInVsOutResponse,
  AnalyticsSummaryResponse,
  AnalyticsTopProductsResponse,
  ListResponse,
  Plant,
  Product,
  Warehouse,
} from '../../api/types';

type Props = { token: string };

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toIsoRange(fromDate: string, toDate: string) {
  const from = fromDate ? `${fromDate}T00:00:00.000Z` : '';
  const to = toDate ? `${toDate}T23:59:59.999Z` : '';
  return { from, to };
}

function formatPct(pct: number | null) {
  if (pct === null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(1)}%`;
}

function metricTone(diff: number, goodWhenUp: boolean) {
  if (diff === 0) return 'text-white/70';
  const positiveIsGood = goodWhenUp;
  const isGood = diff > 0 ? positiveIsGood : !positiveIsGood;
  return isGood ? 'text-emerald-300' : 'text-red-300';
}

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#fb7185'];

function Card(props: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-bold">{props.title}</div>
        {props.actions ? <div className="flex items-center gap-2">{props.actions}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

function KpiCard(props: { label: string; value: string | number; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-white/70">{props.label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{props.value}</div>
      {props.sub ? <div className="mt-1 text-sm">{props.sub}</div> : null}
    </div>
  );
}

function useDashboardState() {
  const initial = useMemo(() => {
    const url = new URL(window.location.href);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const warehouseId = url.searchParams.get('warehouseId') ?? '';
    const plantId = url.searchParams.get('plantId') ?? '';
    const productId = url.searchParams.get('productId') ?? '';
    const invalidLeadersBy = (url.searchParams.get('invalidBy') ?? 'scannedBy') as 'scannedBy' | 'warehouse';

    const today = new Date();
    const defaultTo = dateOnly(today);
    const defaultFrom = dateOnly(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));

    return {
      from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom,
      to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo,
      warehouseId,
      plantId,
      productId,
      invalidLeadersBy,
    };
  }, []);

  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [warehouseId, setWarehouseId] = useState(initial.warehouseId);
  const [plantId, setPlantId] = useState(initial.plantId);
  const [productId, setProductId] = useState(initial.productId);
  const [invalidLeadersBy, setInvalidLeadersBy] = useState<'scannedBy' | 'warehouse'>(initial.invalidLeadersBy);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('from', fromDate);
    url.searchParams.set('to', toDate);
    if (warehouseId) url.searchParams.set('warehouseId', warehouseId);
    else url.searchParams.delete('warehouseId');
    if (plantId) url.searchParams.set('plantId', plantId);
    else url.searchParams.delete('plantId');
    if (productId) url.searchParams.set('productId', productId);
    else url.searchParams.delete('productId');
    url.searchParams.set('invalidBy', invalidLeadersBy);
    window.history.replaceState(null, '', url.toString());
  }, [fromDate, toDate, warehouseId, plantId, productId, invalidLeadersBy]);

  return {
    fromDate,
    toDate,
    warehouseId,
    plantId,
    productId,
    invalidLeadersBy,
    setFromDate,
    setToDate,
    setWarehouseId,
    setPlantId,
    setProductId,
    setInvalidLeadersBy,
  };
}

export function DashboardPage({ token }: Props) {
  const state = useDashboardState();
  const { fromDate, toDate, warehouseId, plantId, productId, invalidLeadersBy } = state;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [scansTrend, setScansTrend] = useState<AnalyticsScansTrendResponse | null>(null);
  const [scanShare, setScanShare] = useState<AnalyticsScansStatusShareResponse | null>(null);
  const [movementShare, setMovementShare] = useState<AnalyticsMovementsTypeShareResponse | null>(null);
  const [topProducts, setTopProducts] = useState<AnalyticsTopProductsResponse | null>(null);
  const [invalidLeaders, setInvalidLeaders] = useState<AnalyticsInvalidLeadersResponse | null>(null);
  const [inVsOut, setInVsOut] = useState<AnalyticsStockInVsOutResponse | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    const { from, to } = toIsoRange(fromDate, toDate);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (warehouseId) params.set('warehouseId', warehouseId);
    if (plantId) params.set('plantId', plantId);
    if (productId) params.set('productId', productId);
    return `?${params.toString()}`;
  }, [fromDate, toDate, warehouseId, plantId, productId]);

  const invalidLeadersQuery = useMemo(() => {
    const params = new URLSearchParams(query.replace(/^\?/, ''));
    params.set('invalidLeadersBy', invalidLeadersBy);
    params.set('take', '10');
    return `?${params.toString()}`;
  }, [query, invalidLeadersBy]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<ListResponse<Warehouse>>('/warehouses?skip=0&take=200', { token }),
      apiFetch<ListResponse<Plant>>('/plants?skip=0&take=200', { token }),
      apiFetch<ListResponse<Product>>('/products?skip=0&take=200', { token }),
    ])
      .then(([wh, pl, pr]) => {
        if (cancelled) return;
        setWarehouses(wh.items);
        setPlants(pl.items);
        setProducts(pr.items);
      })
      .catch(() => {})
      .finally(() => {});

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<AnalyticsSummaryResponse>(`/analytics/summary${query}`, { token }),
      apiFetch<AnalyticsScansTrendResponse>(`/analytics/scans/trend${query}`, { token }),
      apiFetch<AnalyticsScansStatusShareResponse>(`/analytics/scans/status-share${query}`, { token }),
      apiFetch<AnalyticsMovementsTypeShareResponse>(`/analytics/movements/type-share${query}`, { token }),
      apiFetch<AnalyticsTopProductsResponse>(`/analytics/movements/top-products${query}&take=10`, { token }),
      apiFetch<AnalyticsInvalidLeadersResponse>(`/analytics/scans/invalid-leaders${invalidLeadersQuery}`, { token }),
      apiFetch<AnalyticsStockInVsOutResponse>(`/analytics/stock/in-vs-out${query}`, { token }),
    ])
      .then(([s, st, ss, ms, tp, il, io]) => {
        if (cancelled) return;
        setSummary(s);
        setScansTrend(st);
        setScanShare(ss);
        setMovementShare(ms);
        setTopProducts(tp);
        setInvalidLeaders(il);
        setInVsOut(io);
      })
      .catch((e: any) => !cancelled && setError(e?.message ?? 'Failed to load analytics'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [token, query, invalidLeadersQuery]);

  const scansByDay = useMemo(() => {
    return (scansTrend?.items ?? []).map((i) => ({
      date: i.date,
      success: i.success,
      invalid: i.invalid,
      failed: i.failed,
      total: i.total,
      invalidRate: i.total > 0 ? (i.invalid / i.total) * 100 : 0,
    }));
  }, [scansTrend]);

  const movementBars = useMemo(() => {
    return (movementShare?.items ?? []).map((i) => ({
      movementType: i.movementType,
      count: i.count,
      quantity: i.quantity,
    }));
  }, [movementShare]);

  const stockInOutByDay = useMemo(() => {
    return (inVsOut?.items ?? []).map((i) => ({ date: i.date, stockIn: i.stockIn, stockOut: i.stockOut }));
  }, [inVsOut]);

  const topProductBars = useMemo(() => {
    return (topProducts?.items ?? []).map((i) => ({
      label: i.product.sku,
      quantitySum: i.quantitySum,
      movementCount: i.movementCount,
      name: i.product.name,
    }));
  }, [topProducts]);

  const scansSharePie = useMemo(() => {
    return (scanShare?.items ?? []).map((i) => ({
      name: i.scanStatus,
      value: i.count,
    }));
  }, [scanShare]);

  const movementSharePie = useMemo(() => {
    return (movementShare?.items ?? []).map((i) => ({
      name: i.movementType,
      value: i.count,
      quantity: i.quantity,
    }));
  }, [movementShare]);

  const leadersRows = useMemo(() => {
    if (!invalidLeaders) return [];
    if (invalidLeaders.by === 'warehouse') {
      return invalidLeaders.items.map((i) => ({
        label: i.warehouse ? `${i.warehouse.code} — ${i.warehouse.name}` : 'Unknown warehouse',
        count: i.count,
      }));
    }
    return invalidLeaders.items.map((i) => ({
      label: `${i.user.email}`,
      count: i.count,
    }));
  }, [invalidLeaders]);

  const cards = summary?.metrics;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-2 pb-10 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Dashboard</div>
          <div className="text-sm text-white/70">KPIs, distributions, and trends.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-sm text-white/70">From</div>
          <input
            className="h-9 rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-purple-500/60"
            type="date"
            value={fromDate}
            onChange={(e) => state.setFromDate(e.target.value)}
          />
          <div className="text-sm text-white/70">To</div>
          <input
            className="h-9 rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-purple-500/60"
            type="date"
            value={toDate}
            onChange={(e) => state.setToDate(e.target.value)}
          />
          <select
            className="h-9 rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-purple-500/60"
            value={warehouseId}
            onChange={(e) => state.setWarehouseId(e.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-purple-500/60"
            value={plantId}
            onChange={(e) => state.setPlantId(e.target.value)}
          >
            <option value="">All plants</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 max-w-[260px] rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-purple-500/60"
            value={productId}
            onChange={(e) => state.setProductId(e.target.value)}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Products"
          value={loading ? '…' : cards?.productsTotal.curr ?? 0}
          sub={
            loading ? null : (
              <span className={metricTone(cards?.productsTotal.diff ?? 0, true)}>
                {formatPct(cards?.productsTotal.pct ?? 0)} vs prev
              </span>
            )
          }
        />
        <KpiCard
          label="Stock qty (sum)"
          value={loading ? '…' : cards?.stockTotalQuantity.curr ?? 0}
          sub={
            loading ? null : (
              <span className={metricTone(cards?.stockTotalQuantity.diff ?? 0, true)}>
                {formatPct(cards?.stockTotalQuantity.pct ?? 0)} vs prev
              </span>
            )
          }
        />
        <KpiCard
          label="Scans (range)"
          value={loading ? '…' : cards?.scansTotal.curr ?? 0}
          sub={
            loading ? null : (
              <span className={metricTone(cards?.scansTotal.diff ?? 0, true)}>
                {formatPct(cards?.scansTotal.pct ?? 0)} vs prev · Today <code>{cards?.todayScansTotal.curr ?? 0}</code>
              </span>
            )
          }
        />
        <KpiCard
          label="Invalid scans (range)"
          value={loading ? '…' : cards?.scansInvalid.curr ?? 0}
          sub={
            loading ? null : (
              <span className={metricTone(cards?.scansInvalid.diff ?? 0, false)}>
                {formatPct(cards?.scansInvalid.pct ?? 0)} vs prev
              </span>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Scans by status (stacked)">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : scansByDay.length === 0 ? (
            <div className="text-sm text-white/60">No scan events in this range.</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scansByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <Legend />
                  <Bar dataKey="success" stackId="a" fill="#10b981" name="SUCCESS" />
                  <Bar dataKey="invalid" stackId="a" fill="#f59e0b" name="INVALID_QR" />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" name="FAILED" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Invalid rate (%)">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : scansByDay.length === 0 ? (
            <div className="text-sm text-white/60">No scan events in this range.</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scansByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <Line type="monotone" dataKey="invalidRate" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Scan status share">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : scansSharePie.reduce((acc, i) => acc + i.value, 0) === 0 ? (
            <div className="text-sm text-white/60">No scan events in this range.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <Legend />
                  <Pie data={scansSharePie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {scansSharePie.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Movements by type (count)">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : movementBars.length === 0 ? (
            <div className="text-sm text-white/60">No movements in this range.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movementBars} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="movementType" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <Bar dataKey="count" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Movement type share">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : movementSharePie.reduce((acc, i) => acc + i.value, 0) === 0 ? (
            <div className="text-sm text-white/60">No movements in this range.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <Legend />
                  <Pie data={movementSharePie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {movementSharePie.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top products (movement qty)">
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : topProductBars.length === 0 ? (
            <div className="text-sm text-white/60">No movement data in this range.</div>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductBars} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <Bar dataKey="quantitySum" fill="#10b981" name="Qty moved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {!loading && topProducts?.items?.length ? (
            <div className="mt-3 overflow-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black/30">
                    <th className="border-b border-white/10 p-2 text-left text-sm font-semibold">SKU</th>
                    <th className="border-b border-white/10 p-2 text-left text-sm font-semibold">Name</th>
                    <th className="border-b border-white/10 p-2 text-right text-sm font-semibold">Qty</th>
                    <th className="border-b border-white/10 p-2 text-right text-sm font-semibold">Moves</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.items.map((i) => (
                    <tr key={i.product.id} className="odd:bg-white/[0.02]">
                      <td className="border-b border-white/10 p-2 text-sm">
                        <code>{i.product.sku}</code>
                      </td>
                      <td className="border-b border-white/10 p-2 text-sm text-white/80">{i.product.name}</td>
                      <td className="border-b border-white/10 p-2 text-right text-sm">{i.quantitySum}</td>
                      <td className="border-b border-white/10 p-2 text-right text-sm">{i.movementCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <Card
          title="Invalid scan leaders"
          actions={
            <select
              className="h-9 rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none focus:border-purple-500/60"
              value={invalidLeadersBy}
              onChange={(e) => state.setInvalidLeadersBy(e.target.value as any)}
            >
              <option value="scannedBy">By user</option>
              <option value="warehouse">By warehouse</option>
            </select>
          }
        >
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : leadersRows.length === 0 ? (
            <div className="text-sm text-white/60">No invalid scans in this range.</div>
          ) : (
            <>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={leadersRows}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }}
                    />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    <Bar dataKey="count" fill="#f59e0b" name="Invalid scans" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 overflow-auto rounded-xl border border-white/10">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-black/30">
                      <th className="border-b border-white/10 p-2 text-left text-sm font-semibold">
                        {invalidLeadersBy === 'warehouse' ? 'Warehouse' : 'User'}
                      </th>
                      <th className="border-b border-white/10 p-2 text-right text-sm font-semibold">Invalid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadersRows.map((r) => (
                      <tr key={r.label} className="odd:bg-white/[0.02]">
                        <td className="border-b border-white/10 p-2 text-sm text-white/80">{r.label}</td>
                        <td className="border-b border-white/10 p-2 text-right text-sm">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      <Card title="Stock in vs stock out (qty per day)">
        {loading ? (
          <div className="text-sm text-white/60">Loading…</div>
        ) : stockInOutByDay.length === 0 ? (
          <div className="text-sm text-white/60">No movement data in this range.</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockInOutByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.12)' }} />
                <Legend />
                <Line type="monotone" dataKey="stockIn" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="stockOut" stroke="#ef4444" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

