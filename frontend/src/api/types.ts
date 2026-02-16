export type TokenResponse = { access_token: string; token_type: string };

export type UserPublic = {
  id: number;
  username: string;
  is_admin: boolean;
  avatar_base64?: string | null;
};

export type Warehouse = { id: number; name: string };

export type Lot = {
  uid: number;
  warehouse_id: number;
  name: string;
  categories: string[];
  tags: string[];
  quantity: number;
  price?: number | null;
  currency: string;
  description?: string | null;
  purchase_url?: string | null;
  documentation_url?: string | null;
  purchase_label?: string | null;
  image_base64?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type DashboardLot = {
  uid: number;
  name: string;
  quantity: number;
  price?: number | null;
  currency: string;
  last_action_at?: string | null;
};

export type DashboardOverview = {
  warehouse_id: number;
  warehouse_name: string;
  last_added: DashboardLot[];
  last_used: DashboardLot[];
  top_by_quantity: DashboardLot[];
  most_used: DashboardLot[];
};

export type DbImportResult = {
  ok: boolean;
  imported: Record<string, number>;
};
