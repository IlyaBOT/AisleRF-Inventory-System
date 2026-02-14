import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import type { Warehouse } from "./api/types";
import * as api from "./api/client";
import { TopBar } from "./components/TopBar";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { StoragePage } from "./pages/Storage";
import { SystemPage } from "./pages/System";
import { DebugPage } from "./pages/Debug";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  const mode = import.meta.env.VITE_APP_MODE || "dev";
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await api.listWarehouses();
      const def = list.find((w) => w.name === "default") || list[0] || null;
      if (def) setWarehouse(def);
    })();
  }, [user?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        // TopBar has modal button - users can click; no global open for now
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <div className="container">
              <TopBar warehouse={warehouse} setWarehouse={setWarehouse} />
            </div>

            <Routes>
              <Route path="/" element={<DashboardPage warehouse={warehouse} />} />
              <Route path="/storage" element={<StoragePage warehouse={warehouse} />} />
              <Route path="/system" element={<SystemPage warehouse={warehouse} />} />
              {mode === "dev" ? <Route path="/debug" element={<DebugPage />} /> : null}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <div className="container" style={{ margin: "18px auto 28px auto" }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Workshop Inventory • {mode} • стек: FastAPI + Postgres + React • да, это всё в Docker 🧪
              </div>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
