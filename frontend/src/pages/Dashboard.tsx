import React, { useEffect, useState } from "react";
import type { DashboardOverview, Warehouse } from "../api/types";
import * as api from "../api/client";
import { GlassCard } from "../components/GlassCard";

function List({ title, items }: { title: string; items: any[] }) {
  return (
    <GlassCard title={title} subtitle="за последнее время">
      <div className="col" style={{ gap: 8 }}>
        {items.length ? (
          items.map((x) => (
            <div key={x.uid} className="glass-soft" style={{ padding: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{x.name}</div>
                <div className="muted">#{x.uid}</div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Имеется: <b style={{ color: "rgba(255,255,255,0.92)" }}>{x.quantity} шт.</b>
                {x.price != null ? ` • ${x.price.toFixed(2)} ${x.currency}` : ""}
              </div>
            </div>
          ))
        ) : (
          <div className="muted">Пока нечего показать.</div>
        )}
      </div>
    </GlassCard>
  );
}

export function DashboardPage({ warehouse }: { warehouse: Warehouse | null }) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!warehouse) return;
    setMsg(null);
    try {
      setData(await api.dashboardOverview(warehouse.id));
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    }
  }

  useEffect(() => {
    load();
  }, [warehouse?.id]);

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <div className="row" style={{ alignItems: "stretch", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 340 }}>
          <GlassCard
            title="Дэшборд"
            subtitle={warehouse ? `Склад: ${warehouse.name}` : "Склад не выбран"}
            right={<button className="btn" onClick={load}>Обновить</button>}
          >
            {msg ? <div className="muted" style={{ marginTop: 10 }}>{msg}</div> : null}
          </GlassCard>
        </div>
      </div>

      <div className="row" style={{ alignItems: "stretch", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title="Последние добавленные" items={data.last_added} /> : null}</div>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title="Последние использованные" items={data.last_used} /> : null}</div>
      </div>

      <div className="row" style={{ alignItems: "stretch", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title="Топ-15 по количеству" items={data.top_by_quantity} /> : null}</div>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title="Самые часто используемые" items={data.most_used} /> : null}</div>
      </div>
    </div>
  );
}
