import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client';
import type { ListResponse, Warehouse, Zone } from '../../api/types';

type Props = { token: string };

export function ZonesPage({ token }: Props) {
  const [q, setQ] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse<Zone> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [createWarehouseId, setCreateWarehouseId] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('take', String(take));
    if (q.trim()) params.set('q', q.trim());
    if (warehouseId) params.set('warehouseId', warehouseId);
    return `?${params.toString()}`;
  }, [q, skip, warehouseId]);

  async function loadWarehouses() {
    const res = await apiFetch<ListResponse<Warehouse>>('/warehouses?skip=0&take=200', { token });
    setWarehouses(res.items);
    if (!createWarehouseId && res.items.length > 0) setCreateWarehouseId(res.items[0]!.id);
  }

  async function loadZones() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ListResponse<Zone>>(`/zones${query}`, { token });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function createZone() {
    setError(null);
    try {
      await apiFetch<Zone>('/zones', {
        method: 'POST',
        token,
        json: { code, name, warehouseId: createWarehouseId },
      });
      setCode('');
      setName('');
      setSkip(0);
      await loadZones();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create zone');
    }
  }

  async function deleteZone(id: string) {
    if (!confirm('Delete this zone?')) return;
    setError(null);
    try {
      await apiFetch(`/zones/${id}`, { method: 'DELETE', token });
      await loadZones();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete zone');
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h2>Zones</h2>
        <div className="row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code/name…" />
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSkip(0)}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Create zone</h3>
        <div className="row">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. Z1)" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <select value={createWarehouseId} onChange={(e) => setCreateWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createZone}
            disabled={!code.trim() || !name.trim() || !createWarehouseId}
          >
            Create
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="muted">Loading…</div> : null}

      <div className="card">
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Warehouse</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((z) => (
                <tr key={z.id}>
                  <td>
                    <code>{z.code}</code>
                  </td>
                  <td>{z.name}</td>
                  <td className="muted">{z.warehouse?.code ?? z.warehouseId}</td>
                  <td className="right">
                    <button type="button" className="danger" onClick={() => deleteZone(z.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No zones found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="row spaceBetween">
          <div className="muted">
            Total: {data?.total ?? 0} | Page: {Math.floor((data?.skip ?? 0) / take) + 1}
          </div>
          <div className="row">
            <button type="button" onClick={() => setSkip(Math.max(0, skip - take))} disabled={skip === 0}>
              Prev
            </button>
            <button
              type="button"
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

