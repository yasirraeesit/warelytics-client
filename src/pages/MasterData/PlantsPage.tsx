import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client';
import type { ListResponse, Plant } from '../../api/types';

type Props = { token: string };

export function PlantsPage({ token }: Props) {
  const [q, setQ] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse<Plant> | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('take', String(take));
    if (q.trim()) params.set('q', q.trim());
    return `?${params.toString()}`;
  }, [q, skip]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ListResponse<Plant>>(`/plants${query}`, { token });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load plants');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function createPlant() {
    setError(null);
    try {
      await apiFetch<Plant>('/plants', {
        method: 'POST',
        token,
        json: { code, name },
      });
      setCode('');
      setName('');
      setSkip(0);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create plant');
    }
  }

  async function deletePlant(id: string) {
    if (!confirm('Delete this plant?')) return;
    setError(null);
    try {
      await apiFetch(`/plants/${id}`, { method: 'DELETE', token });
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete plant');
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h2>Plants</h2>
        <div className="row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code/name…" />
          <button type="button" onClick={() => setSkip(0)}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Create plant</h3>
        <div className="row">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. PLT-01)" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <button type="button" onClick={createPlant} disabled={!code.trim() || !name.trim()}>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <code>{p.code}</code>
                  </td>
                  <td>{p.name}</td>
                  <td className="right">
                    <button type="button" className="danger" onClick={() => deletePlant(p.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No plants found.
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

