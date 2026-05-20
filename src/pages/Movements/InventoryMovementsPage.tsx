import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client';
import type { InventoryMovement, InventoryMovementType, ListResponse } from '../../api/types';

type Props = { token: string };

const TYPES: Array<{ label: string; value: '' | InventoryMovementType }> = [
  { label: 'All', value: '' },
  { label: 'STOCK_IN', value: 'STOCK_IN' },
  { label: 'STOCK_OUT', value: 'STOCK_OUT' },
  { label: 'TRANSFER', value: 'TRANSFER' },
  { label: 'DAMAGE', value: 'DAMAGE' },
  { label: 'AUDIT_ADJUSTMENT', value: 'AUDIT_ADJUSTMENT' },
];

function toIsoRange(fromDate: string, toDate: string) {
  const from = fromDate ? `${fromDate}T00:00:00.000Z` : '';
  const to = toDate ? `${toDate}T23:59:59.999Z` : '';
  return { from, to };
}

export function InventoryMovementsPage({ token }: Props) {
  const [q, setQ] = useState('');
  const [movementType, setMovementType] = useState<'' | InventoryMovementType>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse<InventoryMovement> | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('take', String(take));
    if (q.trim()) params.set('q', q.trim());
    if (movementType) params.set('movementType', movementType);
    const { from, to } = toIsoRange(fromDate, toDate);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `?${params.toString()}`;
  }, [q, skip, movementType, fromDate, toDate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ListResponse<InventoryMovement>>(`/inventory-movements${query}`, { token });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide">Inventory Movements</h2>
          <div className="text-sm text-white/70">Track stock in/out, transfers, and adjustments.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            className="w-[min(360px,55vw)] rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search remarks…"
          />
          <select
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as any)}
          >
            {TYPES.map((t) => (
              <option key={t.label} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <button type="button" className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25" onClick={() => setSkip(0)}>
            Apply
          </button>
        </div>
      </div>

      {error ? <div className="text-red-400">{error}</div> : null}
      {loading ? <div className="text-white/70">Loading…</div> : null}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="overflow-auto rounded-2xl border border-white/10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 bg-black/40 backdrop-blur">
                <th className="border-b border-white/10 p-3 text-left font-semibold">Time</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Type</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Qty</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Product</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">From</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">To</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((m) => (
                <tr key={m.id} className="odd:bg-white/[0.02] hover:bg-purple-500/5">
                  <td className="border-b border-white/10 p-3 text-sm text-white/70">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="border-b border-white/10 p-3">
                    <code>{m.movementType}</code>
                  </td>
                  <td className="border-b border-white/10 p-3">{m.quantity}</td>
                  <td className="border-b border-white/10 p-3 text-white/70">{m.product?.sku ?? <code>{m.productId}</code>}</td>
                  <td className="border-b border-white/10 p-3 text-white/70">
                    {m.fromWarehouseId ? <code>{m.fromWarehouseId}</code> : '—'}
                    {m.fromZoneId ? (
                      <>
                        {' '}
                        / <code>{m.fromZoneId}</code>
                      </>
                    ) : null}
                  </td>
                  <td className="border-b border-white/10 p-3 text-white/70">
                    {m.toWarehouseId ? <code>{m.toWarehouseId}</code> : '—'}
                    {m.toZoneId ? (
                      <>
                        {' '}
                        / <code>{m.toZoneId}</code>
                      </>
                    ) : null}
                  </td>
                  <td className="border-b border-white/10 p-3 text-white/70">{m.remarks ?? '—'}</td>
                </tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="p-3 text-white/70">
                    No movements found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-white/70">
            Total: {data?.total ?? 0} | Page: {Math.floor((data?.skip ?? 0) / take) + 1}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60" onClick={() => setSkip(Math.max(0, skip - take))} disabled={skip === 0}>
              Prev
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
              onClick={() => setSkip(skip + take)}
              disabled={(data?.items?.length ?? 0) < take}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
