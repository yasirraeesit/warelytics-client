export type Role = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Zone = {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  createdAt: string;
  updatedAt: string;
  warehouse?: Warehouse;
};

export type Plant = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductStatus = 'ACTIVE' | 'DAMAGED' | 'LOST' | 'ARCHIVED';

export type QrCode = {
  id: string;
  value: string;
  productId: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description?: string | null;
  quantity: number;
  status: ProductStatus;
  warehouseId: string;
  zoneId?: string | null;
  plantId?: string | null;
  createdAt: string;
  updatedAt: string;
  qrCode?: QrCode | null;
  warehouse?: Warehouse;
  zone?: Zone | null;
  plant?: Plant | null;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
  skip: number;
  take: number;
};

export type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; name: string; role: Role };
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScanStatus = 'SUCCESS' | 'INVALID_QR' | 'FAILED';
export type InventoryMovementType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'TRANSFER'
  | 'DAMAGE'
  | 'AUDIT_ADJUSTMENT';

export type ScanEvent = {
  id: string;
  qrCodeValue: string;
  scanStatus: ScanStatus;
  scannedAt: string;
  remarks?: string | null;
  scannedById: string;
  productId?: string | null;
  warehouseId?: string | null;
  zoneId?: string | null;
  plantId?: string | null;
  actionType?: InventoryMovementType | null;
  movementId?: string | null;
  scannedBy?: Pick<User, 'id' | 'email' | 'name' | 'role'>;
  product?: Product | null;
};

export type InventoryMovement = {
  id: string;
  movementType: InventoryMovementType;
  quantity: number;
  remarks?: string | null;
  createdAt: string;
  productId: string;
  fromWarehouseId?: string | null;
  fromZoneId?: string | null;
  fromPlantId?: string | null;
  toWarehouseId?: string | null;
  toZoneId?: string | null;
  toPlantId?: string | null;
  product?: Product | null;
};

export type AnalyticsKpisResponse = {
  range: { from: string; to: string };
  productsTotal: number;
  stockTotalQuantity: number;
  scansTotal: number;
  scansSuccess: number;
  scansInvalid: number;
  scansFailed: number;
  movementsTotal: number;
  today: { date: string; scansTotal: number; movementsTotal: number };
};

export type AnalyticsSummaryResponse = {
  range: { from: string; to: string };
  prevRange: { from: string; to: string };
  metrics: {
    productsTotal: { curr: number; prev: number; diff: number; pct: number | null };
    stockTotalQuantity: { curr: number; prev: number; diff: number; pct: number | null };
    scansTotal: { curr: number; prev: number; diff: number; pct: number | null };
    scansInvalid: { curr: number; prev: number; diff: number; pct: number | null };
    movementsTotal: { curr: number; prev: number; diff: number; pct: number | null };
    todayScansTotal: { curr: number };
    todayMovementsTotal: { curr: number };
  };
  raw: AnalyticsKpisResponse;
};

export type AnalyticsScansTrendResponse = {
  range: { from: string; to: string };
  items: { date: string; total: number; success: number; invalid: number; failed: number }[];
};

export type AnalyticsInvalidScanTrendResponse = {
  range: { from: string; to: string };
  items: { date: string; invalid: number }[];
};

export type AnalyticsMovementsBreakdownResponse = {
  range: { from: string; to: string };
  items: { movementType: InventoryMovementType; count: number; quantity: number }[];
};

export type AnalyticsStockInVsOutResponse = {
  range: { from: string; to: string };
  items: { date: string; stockIn: number; stockOut: number }[];
};

export type AnalyticsScansStatusShareResponse = {
  range: { from: string; to: string };
  items: { scanStatus: ScanStatus; count: number }[];
};

export type AnalyticsMovementsTypeShareResponse = {
  range: { from: string; to: string };
  items: { movementType: InventoryMovementType; count: number; quantity: number }[];
};

export type AnalyticsTopProductsResponse = {
  range: { from: string; to: string };
  items: {
    product: Pick<Product, 'id' | 'sku' | 'name' | 'category'>;
    movementCount: number;
    quantitySum: number;
  }[];
};

export type AnalyticsInvalidLeadersResponse =
  | {
      range: { from: string; to: string };
      by: 'scannedBy';
      items: { user: Pick<User, 'id' | 'email' | 'name' | 'role'>; count: number }[];
    }
  | {
      range: { from: string; to: string };
      by: 'warehouse';
      items: { warehouse: Pick<Warehouse, 'id' | 'code' | 'name'> | null; count: number }[];
    };
