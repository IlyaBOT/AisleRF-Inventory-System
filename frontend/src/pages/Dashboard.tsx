import React, { useEffect, useState } from "react";
import type { DashboardOverview, Warehouse } from "../api/types";
import * as api from "../api/client";
import { GlassCard } from "../components/GlassCard";
import { useI18n } from "../context/I18nContext";

function List({ title, items }: { title: string; items: any[] }) {
  const { t } = useI18n();

  return (
    <GlassCard title={title} subtitle={t("dashboard.recentSubtitle")}>
      <div className="col" style={{ gap: 8 }}>
        {items.length ? (
          items.map((item) => (
            <div key={item.uid} className="glass-soft" style={{ padding: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <div className="muted">#{item.uid}</div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.available", { quantity: item.quantity })}
                {item.price != null ? ` - ${item.price.toFixed(2)} ${item.currency}` : ""}
              </div>
            </div>
          ))
        ) : (
          <div className="muted">{t("dashboard.empty")}</div>
        )}
      </div>
    </GlassCard>
  );
}

export function DashboardPage({ warehouse }: { warehouse: Warehouse | null }) {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!warehouse) return;
    setMsg(null);
    try {
      setData(await api.dashboardOverview(warehouse.id));
    } catch (e: any) {
      setMsg(e?.message || t("common.error"));
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
            title={t("dashboard.title")}
            subtitle={warehouse ? t("dashboard.warehouseSelected", { name: warehouse.name }) : t("dashboard.warehouseMissing")}
            right={<button className="btn" onClick={load}>{t("common.refresh")}</button>}
          >
            {msg ? <div className="auth-error" style={{ marginTop: 10 }}>{msg}</div> : null}
          </GlassCard>
        </div>
      </div>

      <div className="row" style={{ alignItems: "stretch", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title={t("dashboard.recentAdded")} items={data.last_added} /> : null}</div>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title={t("dashboard.recentUsed")} items={data.last_used} /> : null}</div>
      </div>

      <div className="row" style={{ alignItems: "stretch", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title={t("dashboard.topByQuantity")} items={data.top_by_quantity} /> : null}</div>
        <div style={{ flex: 1, minWidth: 340 }}>{data ? <List title={t("dashboard.mostUsed")} items={data.most_used} /> : null}</div>
      </div>
    </div>
  );
}
