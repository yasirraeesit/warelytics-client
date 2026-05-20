import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, API_URL } from '../../api/client';
import type { ListResponse, Plant, Product, ProductStatus, Role, Warehouse, Zone } from '../../api/types';
import { Drawer } from '../../components/Drawer';

type Props = { token: string; role: Role | null };

const PRODUCT_STATUSES: ProductStatus[] = ['ACTIVE', 'DAMAGED', 'LOST', 'ARCHIVED'];

type LabelSize = 'S' | 'M' | 'L';

function labelPx(size: LabelSize) {
  switch (size) {
    case 'S':
      return 84;
    case 'L':
      return 128;
    case 'M':
    default:
      return 104;
  }
}

export function QrPrintingPage({ token, role }: Props) {
  const canPrint = Boolean(role); // any authed role can print
  const [q, setQ] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse<Product> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [filterZones, setFilterZones] = useState<Zone[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImgs, setPreviewImgs] = useState<Map<string, string>>(new Map());
  const previewObjectUrlsRef = useRef<string[]>([]);

  const [filterStatus, setFilterStatus] = useState<ProductStatus | ''>('');
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>('');
  const [filterZoneId, setFilterZoneId] = useState<string>('');
  const [filterPlantId, setFilterPlantId] = useState<string>('');

  const [columns, setColumns] = useState(3);
  const [size, setSize] = useState<LabelSize>('M');
  const [showSku, setShowSku] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showQrValue, setShowQrValue] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('take', String(take));
    if (q.trim()) params.set('q', q.trim());
    if (filterStatus) params.set('status', filterStatus);
    if (filterWarehouseId) params.set('warehouseId', filterWarehouseId);
    if (filterZoneId) params.set('zoneId', filterZoneId);
    if (filterPlantId) params.set('plantId', filterPlantId);
    return `?${params.toString()}`;
  }, [q, skip, filterStatus, filterWarehouseId, filterZoneId, filterPlantId]);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filterStatus) n++;
    if (filterWarehouseId) n++;
    if (filterZoneId) n++;
    if (filterPlantId) n++;
    return n;
  }, [filterStatus, filterWarehouseId, filterZoneId, filterPlantId]);

  const selectedProducts = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((p) => selectedIds.has(p.id));
  }, [data?.items, selectedIds]);

  const allSelectedOnPage = useMemo(() => {
    const items = data?.items ?? [];
    if (items.length === 0) return false;
    return items.every((p) => selectedIds.has(p.id));
  }, [data?.items, selectedIds]);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ListResponse<Product>>(`/products${query}`, { token });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    try {
      const [whRes, plantsRes] = await Promise.all([
        apiFetch<ListResponse<Warehouse>>('/warehouses?skip=0&take=200', { token }),
        apiFetch<ListResponse<Plant>>('/plants?skip=0&take=200', { token }),
      ]);
      setWarehouses(whRes.items);
      setPlants(plantsRes.items);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!filterWarehouseId) {
      setFilterZoneId('');
      setFilterZones([]);
      return;
    }
    apiFetch<ListResponse<Zone>>(
      `/zones?skip=0&take=200&warehouseId=${encodeURIComponent(filterWarehouseId)}`,
      { token },
    )
      .then((res) => setFilterZones(res.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWarehouseId]);

  function toggleSelected(productId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const items = data?.items ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = !items.every((p) => next.has(p.id));
      for (const p of items) {
        if (shouldSelectAll) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  function cleanupPreviewObjectUrls() {
    for (const u of previewObjectUrlsRef.current) URL.revokeObjectURL(u);
    previewObjectUrlsRef.current = [];
  }

  async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    let idx = 0;
    const workers = Array.from({ length: Math.max(1, limit) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await fn(items[i]);
      }
    });
    await Promise.all(workers);
    return results;
  }

  async function loadPreviewImages(products: Product[]) {
    setPreviewLoading(true);
    setError(null);
    cleanupPreviewObjectUrls();
    setPreviewImgs(new Map());
    try {
      const next = new Map<string, string>();
      await mapWithConcurrency(
        products,
        6,
        async (p) => {
          if (!p.qrCode?.value) return;
          const res = await fetch(`${API_URL}/qr-codes/${p.id}/image`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          previewObjectUrlsRef.current.push(url);
          next.set(p.id, url);
        },
      );
      setPreviewImgs(next);
      if (next.size === 0) setError('No QR images found for the selected products.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load QR images');
    } finally {
      setPreviewLoading(false);
    }
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function printFromPreview(products: Product[]) {
    const px = labelPx(size);
    const printable = products
      .filter((p) => previewImgs.get(p.id))
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        qrValue: p.qrCode?.value ?? '',
        imgUrl: previewImgs.get(p.id)!,
      }));

    if (printable.length === 0) {
      setError('No printable QR images found for the selection.');
      return;
    }

    const w = window.open('', '_blank');
    if (!w) {
      setError('Popup blocked. Allow popups to print labels.');
      return;
    }

    const showText = showSku || showName || showQrValue;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QR Labels</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; margin:24px;}
      .grid{display:grid; grid-template-columns: repeat(${columns}, 1fr); gap:16px;}
      .label{border:1px solid rgba(0,0,0,.12); border-radius:12px; padding:12px; display:grid; grid-template-columns: ${px}px 1fr; gap:12px; align-items:center;}
      img{width:${px}px; height:${px}px;}
      .sku{font-weight:800;}
      .name{opacity:.85; margin-top:4px;}
      .qr{opacity:.65; font-size:12px; margin-top:6px; word-break:break-all;}
      .onlyqr{grid-template-columns: 1fr; justify-items:center;}
      @media print {
        body{margin:0; padding:0;}
        .grid{grid-template-columns: repeat(${columns}, 1fr); gap:10px; padding:10px;}
        .label{break-inside:avoid;}
      }
    </style>
  </head>
  <body>
    <div class="grid">
      ${printable
        .map((l) => {
          const meta = showText
            ? `<div>
                ${showSku ? `<div class="sku">${escapeHtml(l.sku)}</div>` : ''}
                ${showName ? `<div class="name">${escapeHtml(l.name)}</div>` : ''}
                ${showQrValue ? `<div class="qr">${escapeHtml(l.qrValue)}</div>` : ''}
              </div>`
            : '';
          return `<div class="label ${showText ? '' : 'onlyqr'}">
            <img src="${l.imgUrl}" alt="QR ${escapeHtml(l.sku)}" />
            ${meta}
          </div>`;
        })
        .join('')}
    </div>
    <script>
      function waitForImages() {
        var imgs = Array.prototype.slice.call(document.images || []);
        return Promise.all(imgs.map(function(img){
          if (!img) return Promise.resolve();
          if (img.decode) return img.decode().catch(function(){});
          return new Promise(function(resolve){
            if (img.complete) return resolve();
            img.onload = function(){ resolve(); };
            img.onerror = function(){ resolve(); };
          });
        }));
      }
      window.addEventListener('load', function() {
        waitForImages().then(function(){
          setTimeout(function(){ window.print(); }, 50);
        });
      });
    </script>
  </body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  useEffect(() => {
    return () => cleanupPreviewObjectUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide">QR Printing</h2>
          <div className="text-sm text-white/70">Select products and generate printable QR labels.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            className="w-[min(360px,55vw)] rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sku/name/category…"
          />
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25"
            onClick={() => setSkip(0)}
          >
            Search
          </button>
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25"
            onClick={() => setFiltersOpen(true)}
          >
            Filters{activeFiltersCount ? ` (${activeFiltersCount})` : ''}
          </button>
          <button
            type="button"
            className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
            disabled={!canPrint || selectedIds.size === 0}
            onClick={async () => {
              const items = selectedProducts.length > 0 ? selectedProducts : [];
              const selected = items.length > 0 ? items : (data?.items ?? []).filter((p) => selectedIds.has(p.id));
              if (selected.length === 0) return;
              if (selected.length > 100) {
                setError('Please select 100 products or fewer for printing.');
                return;
              }
              setPreviewOpen(true);
              await loadPreviewImages(selected);
            }}
            title={!canPrint ? 'You must be signed in to print.' : undefined}
          >
            Preview / Print
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
                <th className="border-b border-white/10 p-3 text-left font-semibold">
                  <input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAllOnPage} aria-label="Select all on page" />
                </th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">SKU</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Name</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Status</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">QR</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((p) => (
                <tr key={p.id} className="odd:bg-white/[0.02] hover:bg-purple-500/5">
                  <td className="border-b border-white/10 p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      aria-label={`Select ${p.sku}`}
                    />
                  </td>
                  <td className="border-b border-white/10 p-3">
                    <code>{p.sku}</code>
                  </td>
                  <td className="border-b border-white/10 p-3">{p.name}</td>
                  <td className="border-b border-white/10 p-3">
                    <code>{p.status}</code>
                  </td>
                  <td className="border-b border-white/10 p-3">
                    {p.qrCode?.value ? <code title={p.qrCode.value}>{p.qrCode.value}</code> : <span className="text-white/60">—</span>}
                  </td>
                </tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-white/70">
                    No products found.
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

      <Drawer open={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-white/80">Status</div>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="">All</option>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm text-white/80">Warehouse</div>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
              value={filterWarehouseId}
              onChange={(e) => setFilterWarehouseId(e.target.value)}
            >
              <option value="">All</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm text-white/80">Zone</div>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60 disabled:opacity-60"
              value={filterZoneId}
              onChange={(e) => setFilterZoneId(e.target.value)}
              disabled={!filterWarehouseId}
            >
              <option value="">All</option>
              {filterZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} — {z.name}
                </option>
              ))}
            </select>
            {!filterWarehouseId ? <div className="mt-1 text-sm text-white/60">Select a warehouse to filter zones.</div> : null}
          </div>

          <div>
            <div className="text-sm text-white/80">Plant</div>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
              value={filterPlantId}
              onChange={(e) => setFilterPlantId(e.target.value)}
            >
              <option value="">All</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75"
              onClick={() => {
                setSkip(0);
                setFiltersOpen(false);
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25"
              onClick={() => {
                setFilterStatus('');
                setFilterWarehouseId('');
                setFilterZoneId('');
                setFilterPlantId('');
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={previewOpen}
        title="Print preview"
        widthClassName="w-full sm:w-[760px]"
        onClose={() => {
          setPreviewOpen(false);
          setPreviewLoading(false);
          setPreviewImgs(new Map());
          cleanupPreviewObjectUrls();
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-4">
              <div className="text-sm text-white/80">Columns</div>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={String(columns)}
                onChange={(e) => setColumns(Number(e.target.value))}
              >
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <div className="text-sm text-white/80">Size</div>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={size}
                onChange={(e) => setSize(e.target.value as LabelSize)}
              >
                <option value="S">Small</option>
                <option value="M">Medium</option>
                <option value="L">Large</option>
              </select>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <div className="text-sm text-white/80">Show</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <input type="checkbox" checked={showSku} onChange={(e) => setShowSku(e.target.checked)} />
                  <span className="text-sm text-white/80">SKU</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                  <span className="text-sm text-white/80">Name</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <input type="checkbox" checked={showQrValue} onChange={(e) => setShowQrValue(e.target.checked)} />
                  <span className="text-sm text-white/80">QR value</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-white/70">
              Selected: <span className="font-semibold text-white">{selectedIds.size}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
                onClick={async () => {
                  const selected = (data?.items ?? []).filter((p) => selectedIds.has(p.id));
                  await loadPreviewImages(selected);
                }}
                disabled={previewLoading}
              >
                {previewLoading ? 'Loading…' : 'Reload images'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
                onClick={() => {
                  const selected = (data?.items ?? []).filter((p) => selectedIds.has(p.id));
                  printFromPreview(selected);
                }}
                disabled={previewLoading || previewImgs.size === 0}
              >
                Print
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            {previewLoading ? <div className="text-white/70">Preparing preview…</div> : null}
            {!previewLoading && previewImgs.size === 0 ? <div className="text-white/70">No preview available.</div> : null}
            {!previewLoading && previewImgs.size > 0 ? (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {(data?.items ?? [])
                  .filter((p) => selectedIds.has(p.id) && previewImgs.get(p.id))
                  .map((p) => {
                    const url = previewImgs.get(p.id)!;
                    const px = labelPx(size);
                    const showText = showSku || showName || showQrValue;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border border-white/10 bg-black/30 p-3 ${showText ? 'grid gap-3' : 'flex items-center justify-center'}`}
                        style={showText ? { gridTemplateColumns: `${px}px 1fr`, alignItems: 'center' } : undefined}
                      >
                        <img
                          src={url}
                          alt={`QR ${p.sku}`}
                          className="rounded-xl bg-white p-2"
                          style={{ width: px, height: px }}
                        />
                        {showText ? (
                          <div className="min-w-0">
                            {showSku ? <div className="font-extrabold">{p.sku}</div> : null}
                            {showName ? <div className="mt-1 text-sm text-white/80">{p.name}</div> : null}
                            {showQrValue && p.qrCode?.value ? (
                              <div className="mt-2 break-all text-xs text-white/60">{p.qrCode.value}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

