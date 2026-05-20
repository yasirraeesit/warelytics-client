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
  const [createSubmitted, setCreateSubmitted] = useState(false);

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
    setCreateSubmitted(true);
    if (!code.trim() || !name.trim()) return;
    setError(null);
    try {
      await apiFetch<Plant>('/plants', {
        method: 'POST',
        token,
        json: { code, name },
      });
      setCode('');
      setName('');
      setCreateSubmitted(false);
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide">Plants</h2>
          <div className="text-sm text-white/70">Manage plant locations.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            className="w-[min(360px,55vw)] rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code/name…"
          />
          <button type="button" className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25" onClick={() => setSkip(0)}>
            Search
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="mb-3 text-lg font-bold">Create plant</h3>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-4">
            <div className="text-sm text-white/80">Code</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. PLT-01"
            />
            {createSubmitted && !code.trim() ? <div className="mt-1 text-sm text-red-400">Code is required.</div> : null}
          </div>
          <div className="col-span-12 md:col-span-8">
            <div className="text-sm text-white/80">Name</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lahore Plant"
            />
            {createSubmitted && !name.trim() ? <div className="mt-1 text-sm text-red-400">Name is required.</div> : null}
          </div>
          <div className="col-span-12 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75"
              onClick={createPlant}
            >
              Create plant
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25"
              onClick={() => {
                setCode('')
                setName('')
                setCreateSubmitted(false)
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="text-red-400">{error}</div> : null}
      {loading ? <div className="text-white/70">Loading…</div> : null}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="overflow-auto rounded-2xl border border-white/10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 bg-black/40 backdrop-blur">
                <th className="border-b border-white/10 p-3 text-left font-semibold">Code</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Name</th>
                <th className="border-b border-white/10 p-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((p) => (
                <tr key={p.id} className="odd:bg-white/[0.02] hover:bg-purple-500/5">
                  <td className="border-b border-white/10 p-3">
                    <code>{p.code}</code>
                  </td>
                  <td className="border-b border-white/10 p-3">{p.name}</td>
                  <td className="border-b border-white/10 p-3 text-right">
                    <button
                      type="button"
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 hover:border-red-500/40"
                      onClick={() => deletePlant(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-white/70">
                    No plants found.
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
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
              onClick={() => setSkip(Math.max(0, skip - take))}
              disabled={skip === 0}
            >
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
