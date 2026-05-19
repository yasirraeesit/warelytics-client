# Warelytics — Client Portal (Tenant)

Tenant-facing web portal for inventory operations and analytics (scoped to a single company/tenant).

**Tech stack:** React + Vite + TypeScript

## Repositories
- Backend API: `yasirraeesit/warelytics-backend`
- Client (this repo): `yasirraeesit/warelytics-client`
- Mobile app: `yasirraeesit/warelytics-mobile-app`

## Features (Planned/Building)
- Auth:
  - Login, JWT storage, protected routes
  - Role-aware UI (ADMIN/MANAGER/VIEWER)
- Dashboard:
  - KPI cards (totals + today metrics)
  - Charts: scan trend, invalid QR trend, movement breakdown, stock in vs out
- Products:
  - Paginated table, search, filters
  - Create/edit product
  - Product detail: QR preview/download, movement timeline, scan history
- Operations:
  - Scan logs with date range + multi-filter
  - Inventory movements with filters
  - Audit mismatch reports
  - Alerts management
- Exports:
  - CSV exports (scan logs, movements)
  - KPI summary export (PDF/CSV depending on backend)

## Local Setup
```bash
npm install
npm run dev
```

## Configuration
During implementation this app will read:
- `VITE_API_URL` (backend base URL)

## Project Plan
See `PROJECT.md`.
