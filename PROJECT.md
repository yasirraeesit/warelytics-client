# Warelytics — Frontend Plan (Client Portal)

**Repo:** `warelytics-client`  
**Goal:** a tenant portal consuming real backend APIs (master data, products/QR, scans, movements, analytics, exports).

---

## Timeline (6 Weeks, overlaps backend/mobile)

### Phase A — Setup & Layout System (Week 1)
- App shell: navigation (desktop + mobile), header
- Auth scaffolding: login route, protected routes, token storage
- Fetch-based API client (attach token, handle 401)

**Deliverables**
- `/login` + protected routes
- Responsive layout working on mobile and desktop

---

### Phase B — Dashboard KPIs & Trends (Week 2)
- KPI cards (totals + today metrics)
- Charts (Recharts):
  - daily scan trend
  - movement type breakdown
  - invalid QR trend
  - stock in vs stock out
  - products by warehouse/plant
- Date range selector + backend query params

**Acceptance**
- All charts load from backend endpoints (no mocked data)
- Loading, empty, and error states are present

---

### Phase C — Products (Week 3)
- Products table (pagination, search, filters)
- Add/Edit product form (DTO-aligned)
- Product detail page:
  - QR preview + download
  - movement timeline
  - scan history

**Acceptance**
- Product CRUD works end-to-end
- QR download works from UI

---

### Phase D — Scan Logs & Movements (Week 4)
- Scan logs page:
  - date range, status, user, product, warehouse filters
  - paginated table
- Inventory movements page:
  - type/date/product/warehouse filters
  - paginated table

**Acceptance**
- Filters map to backend query params and are shareable via URL

---

### Phase E — Audits, Alerts, Exports (Week 5)
- Audit reports:
  - mismatches list
  - variance details
- Alerts page:
  - alert feed + status management
- Exports page:
  - CSV exports for scans/movements
  - KPI summary export (PDF or initial JSON/CSV)

**Acceptance**
- Export requests create backend export jobs/logs and download files

---

### Phase F — Polish & Portfolio Readiness (Week 6)
- UI polish, empty states, skeletons
- Role-based UI gating (ADMIN/MANAGER/VIEWER)
- Performance: query caching, debounce search, pagination UX
- Docs: screenshots + usage notes
