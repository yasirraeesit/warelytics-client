import { useEffect, useMemo, useState } from 'react';
import { apiFetch, API_URL } from '../../api/client';
import type { ListResponse, Plant, Product, ProductStatus, Role, Warehouse, Zone } from '../../api/types';
import { Drawer } from '../../components/Drawer';

type Props = { token: string; role: Role | null };

const PRODUCT_STATUSES: ProductStatus[] = ['ACTIVE', 'DAMAGED', 'LOST', 'ARCHIVED'];

function getInitialFromUrl() {
  try {
    const url = new URL(window.location.href);
    return {
      q: url.searchParams.get('q') ?? '',
      warehouseId: url.searchParams.get('warehouseId') ?? '',
      openCreate: url.searchParams.get('create') === '1',
    };
  } catch {
    return { q: '', warehouseId: '', openCreate: false };
  }
}

function updateUrlParams(next: Record<string, string | null | undefined>) {
  try {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(next)) {
      if (!v) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  } catch {
    // ignore
  }
}

export function ProductsPage({ token, role }: Props) {
  const initial = useMemo(() => getInitialFromUrl(), []);
  const canWrite = role === 'ADMIN' || role === 'MANAGER';
  const canAdmin = role === 'ADMIN';
  const [q, setQ] = useState(initial.q);
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse<Product> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [filterZones, setFilterZones] = useState<Zone[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrViewingProduct, setQrViewingProduct] = useState<Product | null>(null);
  const [qrViewingDataUrl, setQrViewingDataUrl] = useState<string | null>(null);
  const [qrViewingLoading, setQrViewingLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState<ProductStatus | ''>('');
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>(initial.warehouseId);
  const [filterZoneId, setFilterZoneId] = useState<string>('');
  const [filterPlantId, setFilterPlantId] = useState<string>('');

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [status, setStatus] = useState<ProductStatus>('ACTIVE');
  const [warehouseId, setWarehouseId] = useState('');
  const [zoneId, setZoneId] = useState<string>('');
  const [plantId, setPlantId] = useState<string>('');
  const [createSubmitted, setCreateSubmitted] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState(0);
  const [editStatus, setEditStatus] = useState<ProductStatus>('ACTIVE');
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editZoneId, setEditZoneId] = useState<string>('');
  const [editPlantId, setEditPlantId] = useState<string>('');
  const [editZones, setEditZones] = useState<Zone[]>([]);
  const [editSubmitted, setEditSubmitted] = useState(false);

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

  const selectedOnPage = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((p) => selectedIds.has(p.id));
  }, [data?.items, selectedIds]);

  const allSelectedOnPage = useMemo(() => {
    const items = data?.items ?? [];
    if (items.length === 0) return false;
    return items.every((p) => selectedIds.has(p.id));
  }, [data?.items, selectedIds]);

  useEffect(() => {
    if (!initial.openCreate) return;
    setCreateOpen(true);
    updateUrlParams({ create: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateUrlParams({
      q: q.trim() ? q.trim() : null,
      warehouseId: filterWarehouseId || null,
    });
  }, [q, filterWarehouseId]);

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
      if (!warehouseId && whRes.items[0]?.id) setWarehouseId(whRes.items[0].id);
    } catch {
      // ignore; surfaced via product load anyway
    }
  }

  async function loadZones(nextWarehouseId: string) {
    try {
      if (!nextWarehouseId) {
        setZones([]);
        return;
      }
      const res = await apiFetch<ListResponse<Zone>>(
        `/zones?skip=0&take=200&warehouseId=${encodeURIComponent(nextWarehouseId)}`,
        { token },
      );
      setZones(res.items);
    } catch {
      setZones([]);
    }
  }

  async function loadEditZones(nextWarehouseId: string) {
    try {
      if (!nextWarehouseId) {
        setEditZones([]);
        return;
      }
      const res = await apiFetch<ListResponse<Zone>>(
        `/zones?skip=0&take=200&warehouseId=${encodeURIComponent(nextWarehouseId)}`,
        { token },
      );
      setEditZones(res.items);
    } catch {
      setEditZones([]);
    }
  }

  useEffect(() => {
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadZones(warehouseId);
    setZoneId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  useEffect(() => {
    // keep filter zone list in sync when warehouse filter changes
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

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function resetCreateForm() {
    setSku('');
    setName('');
    setCategory('');
    setDescription('');
    setQuantity(0);
    setStatus('ACTIVE');
    setZoneId('');
    setPlantId('');
    setCreateSubmitted(false);
  }

  const createErrors = useMemo<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    if (!sku.trim()) errors.sku = 'SKU is required.';
    if (!name.trim()) errors.name = 'Name is required.';
    if (!category.trim()) errors.category = 'Category is required.';
    if (!warehouseId) errors.warehouseId = 'Warehouse is required.';
    if (Number.isNaN(quantity) || quantity < 0) errors.quantity = 'Quantity must be 0 or more.';
    return errors;
  }, [sku, name, category, warehouseId, quantity]);

  const editErrors = useMemo<Record<string, string>>(() => {
    if (!editing) return {};
    const errors: Record<string, string> = {};
    if (!editName.trim()) errors.name = 'Name is required.';
    if (!editCategory.trim()) errors.category = 'Category is required.';
    if (!editWarehouseId) errors.warehouseId = 'Warehouse is required.';
    if (Number.isNaN(editQuantity) || editQuantity < 0) errors.quantity = 'Quantity must be 0 or more.';
    return errors;
  }, [editing, editName, editCategory, editWarehouseId, editQuantity]);

  async function createProductAndShowQr() {
    setCreateSubmitted(true);
    if (Object.keys(createErrors).length > 0) return;
    setError(null);
    try {
      const created = await apiFetch<Product>('/products', {
        method: 'POST',
        token,
        json: {
          sku,
          name,
          category,
          description: description.trim() ? description.trim() : undefined,
          quantity,
          status,
          warehouseId,
          zoneId: zoneId || undefined,
          plantId: plantId || undefined,
        },
      });
      setCreateOpen(false);
      resetCreateForm();
      setSkip(0);
      await loadProducts();

      await openQrViewer(created);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create product');
    }
  }

  function startEdit(p: Product) {
    setEditing(p);
    setEditName(p.name ?? '');
    setEditCategory(p.category ?? '');
    setEditDescription(p.description ?? '');
    setEditQuantity(p.quantity ?? 0);
    setEditStatus(p.status ?? 'ACTIVE');
    setEditWarehouseId(p.warehouseId ?? '');
    setEditZoneId(p.zoneId ?? '');
    setEditPlantId(p.plantId ?? '');
    loadEditZones(p.warehouseId ?? '');
    setEditSubmitted(false);
    setEditOpen(true);
  }

  function cancelEdit() {
    setEditing(null);
    setEditZones([]);
    setEditOpen(false);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSubmitted(true);
    if (Object.keys(editErrors).length > 0) return;
    setError(null);
    try {
      await apiFetch<Product>(`/products/${editing.id}`, {
        method: 'PATCH',
        token,
        json: {
          name: editName,
          category: editCategory,
          description: editDescription.trim() ? editDescription.trim() : undefined,
          quantity: editQuantity,
          status: editStatus,
          warehouseId: editWarehouseId,
          zoneId: editZoneId || undefined,
          plantId: editPlantId || undefined,
        },
      });
      cancelEdit();
      await loadProducts();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update product');
    }
  }

  async function archiveProduct(p: Product) {
    if (!confirm(`Archive product ${p.sku}?`)) return;
    setError(null);
    try {
      await apiFetch<Product>(`/products/${p.id}`, { method: 'DELETE', token });
      await loadProducts();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to archive product');
    }
  }

  async function regenerateQr(p: Product) {
    if (!confirm(`Regenerate QR for ${p.sku}? Old QR will stop working.`)) return;
    setError(null);
    try {
      await apiFetch(`/qr-codes/${p.id}/regenerate`, { method: 'POST', token });
      await loadProducts();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to regenerate QR');
    }
  }

  async function downloadQr(p: Product) {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/qr-codes/${p.id}/image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${p.sku || p.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to download QR');
    }
  }

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

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
  }

  async function openQrViewer(p: Product) {
    setError(null);
    setQrViewingProduct(p);
    setQrViewingDataUrl(null);
    setQrViewingLoading(true);
    setQrOpen(true);
    try {
      const res = await fetch(`${API_URL}/qr-codes/${p.id}/image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
      }
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      setQrViewingDataUrl(dataUrl);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load QR image');
    } finally {
      setQrViewingLoading(false);
    }
  }

  async function printSelectedLabels() {
    const items = selectedOnPage.length > 0 ? selectedOnPage : [];
    const selected = items.length > 0 ? items : (data?.items ?? []).filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) {
      setError('Select at least 1 product to print labels.');
      return;
    }

    // guardrail to avoid freezing the browser
    if (selected.length > 50) {
      setError('Please select 50 products or fewer to print at once.');
      return;
    }

    setPrinting(true);
    setError(null);
    try {
      const labels: Array<{ sku: string; name: string; qrValue: string; imgUrl: string }> = [];
      const objectUrls: string[] = [];
      for (const p of selected) {
        if (!p.qrCode?.value) continue;
        const res = await fetch(`${API_URL}/qr-codes/${p.id}/image`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const blob = await res.blob();
        const imgUrl = URL.createObjectURL(blob);
        objectUrls.push(imgUrl);
        labels.push({ sku: p.sku, name: p.name, qrValue: p.qrCode.value, imgUrl });
      }

      if (labels.length === 0) {
        setError('No printable QR images found for the selected products.');
        return;
      }

      const w = window.open('', '_blank');
      if (!w) {
        setError('Popup blocked. Allow popups to print labels.');
        return;
      }

      const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QR Labels</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; margin:24px;}
      .grid{display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;}
      .label{border:1px solid rgba(0,0,0,.12); border-radius:12px; padding:12px; display:grid; grid-template-columns: 92px 1fr; gap:12px; align-items:center;}
      img{width:92px; height:92px;}
      .sku{font-weight:800;}
      .name{opacity:.85; margin-top:4px;}
      .qr{opacity:.65; font-size:12px; margin-top:6px; word-break:break-all;}
      @media print {
        body{margin:0; padding:0;}
        .grid{grid-template-columns: repeat(3, 1fr); gap:10px; padding:10px;}
        .label{break-inside:avoid;}
      }
    </style>
  </head>
  <body>
    <div class="grid">
      ${labels
        .map(
          (l) => `<div class="label">
            <img src="${l.imgUrl}" alt="QR ${escapeHtml(l.sku)}" />
            <div>
              <div class="sku">${escapeHtml(l.sku)}</div>
              <div class="name">${escapeHtml(l.name)}</div>
              <div class="qr">${escapeHtml(l.qrValue)}</div>
            </div>
          </div>`,
        )
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

      const cleanup = () => {
        for (const u of objectUrls) URL.revokeObjectURL(u);
      };
      w.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(cleanup, 2 * 60 * 1000);
    } finally {
      setPrinting(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function shortQr(value: string) {
    if (value.length <= 16) return value;
    return `${value.slice(0, 8)}…${value.slice(-6)}`;
  }

  useEffect(() => {
    if (!editing) return;
    loadEditZones(editWarehouseId);
    setEditZoneId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editWarehouseId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest('[data-row-menu]')) return;
      setOpenMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide">Products</h2>
          <div className="text-sm text-white/70">Create and manage products and QR codes.</div>
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
            onClick={() => setCreateOpen(true)}
            disabled={!canWrite}
            title={!canWrite ? 'Only ADMIN/MANAGER can create products.' : undefined}
          >
            Create product
          </button>
        </div>
      </div>

      {error ? <div className="text-red-400">{error}</div> : null}
      {loading ? <div className="text-white/70">Loading…</div> : null}

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
              Reset
            </button>
          </div>
        </div>
      </Drawer>

      <Drawer open={createOpen} title="Create product" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-6">
              <div className="text-sm text-white/80">SKU</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. SKU-1001"
              />
              {createSubmitted && createErrors.sku ? <div className="mt-1 text-sm text-red-400">{createErrors.sku}</div> : null}
            </div>

            <div className="col-span-12 md:col-span-6">
              <div className="text-sm text-white/80">Name</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pallet 20kg"
              />
              {createSubmitted && createErrors.name ? <div className="mt-1 text-sm text-red-400">{createErrors.name}</div> : null}
            </div>

            <div className="col-span-12">
              <div className="text-sm text-white/80">Category</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Raw material"
              />
              {createSubmitted && createErrors.category ? (
                <div className="mt-1 text-sm text-red-400">{createErrors.category}</div>
              ) : null}
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-sm text-white/80">Quantity</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                type="number"
                min={0}
              />
              {createSubmitted && createErrors.quantity ? (
                <div className="mt-1 text-sm text-red-400">{createErrors.quantity}</div>
              ) : (
                <div className="mt-1 text-sm text-white/60">0 or more</div>
              )}
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-sm text-white/80">Status</div>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
              >
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-sm text-white/80">Warehouse</div>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="" disabled>
                  Select warehouse…
                </option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
              {createSubmitted && createErrors.warehouseId ? (
                <div className="mt-1 text-sm text-red-400">{createErrors.warehouseId}</div>
              ) : null}
            </div>

            <div className="col-span-12 md:col-span-6">
              <div className="text-sm text-white/80">Zone (optional)</div>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60 disabled:opacity-60"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                disabled={!warehouseId}
              >
                <option value="">Select zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} — {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-12 md:col-span-6">
              <div className="text-sm text-white/80">Plant (optional)</div>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
              >
                <option value="">Select plant…</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-12">
              <div className="text-sm text-white/80">Description (optional)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes…"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
              onClick={createProductAndShowQr}
              disabled={!canWrite}
            >
              Create & print
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25"
              onClick={resetCreateForm}
            >
              Clear
            </button>
          </div>
        </div>
      </Drawer>

      <Drawer open={editOpen && Boolean(editing)} title={editing ? `Edit ${editing.sku}` : 'Edit product'} onClose={cancelEdit}>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <div className="text-sm text-white/80">Name</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                />
                {editSubmitted && editErrors.name ? <div className="mt-1 text-sm text-red-400">{editErrors.name}</div> : null}
              </div>

              <div className="col-span-12 md:col-span-6">
                <div className="text-sm text-white/80">Category</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="Category"
                />
                {editSubmitted && editErrors.category ? (
                  <div className="mt-1 text-sm text-red-400">{editErrors.category}</div>
                ) : null}
              </div>

              <div className="col-span-12 md:col-span-4">
                <div className="text-sm text-white/80">Quantity</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(Number(e.target.value))}
                  type="number"
                  min={0}
                />
                {editSubmitted && editErrors.quantity ? (
                  <div className="mt-1 text-sm text-red-400">{editErrors.quantity}</div>
                ) : (
                  <div className="mt-1 text-sm text-white/60">0 or more</div>
                )}
              </div>

              <div className="col-span-12 md:col-span-4">
                <div className="text-sm text-white/80">Status</div>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ProductStatus)}
                >
                  {PRODUCT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 md:col-span-4">
                <div className="text-sm text-white/80">Warehouse</div>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editWarehouseId}
                  onChange={(e) => setEditWarehouseId(e.target.value)}
                >
                  <option value="" disabled>
                    Select warehouse…
                  </option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                {editSubmitted && editErrors.warehouseId ? (
                  <div className="mt-1 text-sm text-red-400">{editErrors.warehouseId}</div>
                ) : null}
              </div>

              <div className="col-span-12 md:col-span-6">
                <div className="text-sm text-white/80">Zone (optional)</div>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60 disabled:opacity-60"
                  value={editZoneId}
                  onChange={(e) => setEditZoneId(e.target.value)}
                  disabled={!editWarehouseId}
                >
                  <option value="">Select zone…</option>
                  {editZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 md:col-span-6">
                <div className="text-sm text-white/80">Plant (optional)</div>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editPlantId}
                  onChange={(e) => setEditPlantId(e.target.value)}
                >
                  <option value="">Select plant…</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12">
                <div className="text-sm text-white/80">Description (optional)</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-purple-500/60"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Notes…"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
                onClick={saveEdit}
                disabled={!canWrite}
              >
                Save changes
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={qrOpen}
        title={qrViewingProduct ? `QR · ${qrViewingProduct.sku}` : 'QR'}
        onClose={() => {
          setQrOpen(false);
          setQrViewingProduct(null);
          setQrViewingDataUrl(null);
          setQrViewingLoading(false);
        }}
      >
        {qrViewingProduct ? (
          <div className="space-y-3">
            <div className="text-white/80">
              <div className="font-semibold">{qrViewingProduct.name}</div>
              <div className="text-sm text-white/70">
                <code>{qrViewingProduct.sku}</code>
                {qrViewingProduct.qrCode?.value ? (
                  <>
                    <span className="px-2 text-white/30">•</span>
                    <code title={qrViewingProduct.qrCode.value}>{shortQr(qrViewingProduct.qrCode.value)}</code>
                  </>
                ) : null}
              </div>
            </div>

            {qrViewingLoading ? <div className="text-white/70">Loading QR…</div> : null}

            {qrViewingDataUrl ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <img src={qrViewingDataUrl} alt="QR" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
                onClick={() => {
                  setSelectedIds(new Set([qrViewingProduct.id]));
                  setQrOpen(false);
                  setTimeout(() => printSelectedLabels(), 0);
                }}
                disabled={!qrViewingProduct.qrCode?.value || qrViewingLoading}
              >
                Print label
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
                onClick={() => downloadQr(qrViewingProduct)}
                disabled={!qrViewingProduct.qrCode?.value || qrViewingLoading}
              >
                Download PNG
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
                onClick={() => {
                  if (qrViewingProduct.qrCode?.value) copyToClipboard(qrViewingProduct.qrCode.value);
                }}
                disabled={!qrViewingProduct.qrCode?.value}
              >
                Copy QR value
              </button>
              {canAdmin ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
                  onClick={async () => {
                    await regenerateQr(qrViewingProduct);
                    await openQrViewer(qrViewingProduct);
                  }}
                  disabled={!qrViewingProduct.qrCode?.value || qrViewingLoading}
                >
                  Regenerate QR
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>

      {selectedIds.size > 0 ? (
        <div className="sticky top-[82px] z-10 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-white/80">
              Selected <span className="font-semibold text-white">{selectedIds.size}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-purple-500/55 bg-purple-500/20 px-3 py-2 font-semibold hover:border-purple-500/75 disabled:opacity-60"
                onClick={printSelectedLabels}
                disabled={printing}
              >
                {printing ? 'Preparing…' : 'Print labels'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/10 px-3 py-2 hover:border-white/25 disabled:opacity-60"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="overflow-auto rounded-2xl border border-white/10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 bg-black/40 backdrop-blur">
                <th className="border-b border-white/10 p-3 text-left font-semibold">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">SKU</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Name</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Status</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Qty</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Warehouse</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Zone</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">Plant</th>
                <th className="border-b border-white/10 p-3 text-left font-semibold">QR</th>
                <th className="border-b border-white/10 p-3 text-right font-semibold" />
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
                  <td className="border-b border-white/10 p-3">{p.quantity}</td>
                  <td className="border-b border-white/10 p-3">{p.warehouse ? `${p.warehouse.code}` : <code>{p.warehouseId}</code>}</td>
                  <td className="border-b border-white/10 p-3">
                    {p.zone ? p.zone.code : p.zoneId ? <code>{p.zoneId}</code> : <span className="text-white/60">—</span>}
                  </td>
                  <td className="border-b border-white/10 p-3">
                    {p.plant ? p.plant.code : p.plantId ? <code>{p.plantId}</code> : <span className="text-white/60">—</span>}
                  </td>
                  <td className="border-b border-white/10 p-3">
                    {p.qrCode?.value ? (
                      <div className="flex items-center gap-2">
                        <code title={p.qrCode.value}>{shortQr(p.qrCode.value)}</code>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/10 p-0 text-sm hover:border-white/25"
                          onClick={() => copyToClipboard(p.qrCode!.value)}
                          title="Copy QR value"
                          aria-label="Copy QR value"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    ) : (
                      <span className="text-white/60">—</span>
                    )}
                  </td>
                  <td className="border-b border-white/10 p-3 text-right">
                    <div className="relative inline-flex" data-row-menu>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/10 p-0 hover:border-white/25"
                        onClick={() => setOpenMenuId((cur) => (cur === p.id ? null : p.id))}
                        aria-label="Row actions"
                        title="Actions"
                      >
                        <KebabIcon />
                      </button>
                      {openMenuId === p.id ? (
                        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded-2xl border border-white/15 bg-black/80 p-2 text-left shadow-lg backdrop-blur">
                          <button
                            type="button"
                            className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-left hover:border-white/10 hover:bg-white/5 disabled:opacity-60"
                            onClick={() => {
                              setOpenMenuId(null);
                              startEdit(p);
                            }}
                            disabled={!canWrite}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-left hover:border-white/10 hover:bg-white/5 disabled:opacity-60"
                            onClick={() => {
                              setOpenMenuId(null);
                              openQrViewer(p);
                            }}
                            disabled={!p.qrCode?.value}
                          >
                            View QR
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-left hover:border-white/10 hover:bg-white/5 disabled:opacity-60"
                            onClick={() => {
                              setOpenMenuId(null);
                              downloadQr(p);
                            }}
                            disabled={!p.qrCode?.value}
                          >
                            Download QR
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-left hover:border-white/10 hover:bg-white/5 disabled:opacity-60"
                            onClick={() => {
                              setOpenMenuId(null);
                              regenerateQr(p);
                            }}
                            disabled={!canAdmin}
                          >
                            Regenerate QR
                          </button>
                          <div className="my-2 h-px bg-white/10" />
                          <button
                            type="button"
                            className="w-full rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-left hover:border-red-500/40 disabled:opacity-60"
                            onClick={() => {
                              setOpenMenuId(null);
                              archiveProduct(p);
                            }}
                            disabled={!canAdmin || p.status === 'ARCHIVED'}
                          >
                            Archive
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={10} className="p-3 text-white/70">
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
    </div>
  );
}

function KebabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 9h10v10H9V9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
