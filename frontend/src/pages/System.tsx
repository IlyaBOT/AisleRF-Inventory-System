import React from "react";
import type { Warehouse } from "../api/types";
import { GlassCard } from "../components/GlassCard";

export function SystemPage({ warehouse }: { warehouse: Warehouse | null }) {
  return (
    <div className="container" style={{ marginTop: 16 }}>
      <GlassCard
        title="Система"
        subtitle="Настройки приложения"
      >
        <div className="col">
          <div className="muted">
            Пока что тут пусто. Этот раздел ещё дорабатывается!
          </div>
          <div className="glass-soft" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>Текущее</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Режим: <b style={{ color: "rgba(255,255,255,0.92)" }}>{import.meta.env.VITE_APP_MODE || "dev"}</b>
              <br />
              Склад: <b style={{ color: "rgba(255,255,255,0.92)" }}>{warehouse?.name || "не выбран"}</b>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
