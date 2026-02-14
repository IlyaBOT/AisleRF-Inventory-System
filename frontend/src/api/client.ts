import type {
  TokenResponse,
  UserPublic,
  Warehouse,
  Lot,
  DashboardOverview
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...authHeaders()
    }
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as TokenResponse;
}

export async function me(): Promise<UserPublic> {
  return http<UserPublic>("/users/me");
}

export async function updateMe(username: string): Promise<UserPublic> {
  return http<UserPublic>("/users/me", { method: "PATCH", body: JSON.stringify({ username }) });
}

export async function changePassword(old_password: string, new_password: string): Promise<{ ok: boolean }> {
  return http<{ ok: boolean }>("/users/me/password", {
    method: "PATCH",
    body: JSON.stringify({ old_password, new_password })
  });
}

export async function changeAvatar(avatar_base64: string | null): Promise<UserPublic> {
  return http<UserPublic>("/users/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ avatar_base64 })
  });
}

export async function listWarehouses(): Promise<Warehouse[]> {
  return http<Warehouse[]>("/warehouses");
}

export async function createWarehouse(name: string): Promise<Warehouse> {
  return http<Warehouse>("/warehouses", { method: "POST", body: JSON.stringify({ name }) });
}

export type LotFilters = {
  q?: string;
  price_min?: number;
  price_max?: number;
  categories?: string[];
  tags?: string[];
};

export async function listLots(warehouse_id: number, filters: LotFilters): Promise<Lot[]> {
  const sp = new URLSearchParams();
  sp.set("warehouse_id", String(warehouse_id));
  if (filters.q) sp.set("q", filters.q);
  if (filters.price_min != null) sp.set("price_min", String(filters.price_min));
  if (filters.price_max != null) sp.set("price_max", String(filters.price_max));
  (filters.categories || []).forEach((c) => sp.append("categories", c));
  (filters.tags || []).forEach((t) => sp.append("tags", t));
  return http<Lot[]>(`/lots?${sp.toString()}`);
}

export async function createLot(payload: any): Promise<Lot> {
  return http<Lot>("/lots", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateLot(uid: number, payload: any): Promise<Lot> {
  return http<Lot>(`/lots/${uid}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function consumeLot(uid: number, amount: number, note?: string): Promise<Lot> {
  return http<Lot>(`/lots/${uid}/consume`, { method: "POST", body: JSON.stringify({ amount, note }) });
}

export async function listCategories(): Promise<string[]> {
  return http<string[]>("/lots/meta/categories");
}

export async function listTags(): Promise<string[]> {
  return http<string[]>("/lots/meta/tags");
}

export async function dashboardOverview(warehouse_id: number): Promise<DashboardOverview> {
  const sp = new URLSearchParams({ warehouse_id: String(warehouse_id) });
  return http<DashboardOverview>(`/dashboard/overview?${sp.toString()}`);
}

// dev-only
export async function debugStatus(): Promise<any> {
  return http<any>("/debug/status");
}
