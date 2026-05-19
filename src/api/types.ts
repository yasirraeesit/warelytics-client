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

