import React, { useEffect, useMemo, useState } from "react";
import type { Lot, Warehouse } from "../api/types";
import * as api from "../api/client";
import { FilterPanel, Filters } from "../components/FilterPanel";
import { LotTable } from "../components/LotTable";
import { LotModal } from "../components/LotModal";

export function StoragePage({ warehouse }: { warehouse: Warehouse | null }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: "",
    priceMin: "",
    priceMax: "",
    categories: [],
    tags: []
  });
  const [open, setOpen] = useState(false);

  const backendFilters = useMemo(() => {
    return {
      q: filters.q.trim() || undefined,
      price_min: filters.priceMin.trim() ? Number(filters.priceMin) : undefined,
      price_max: filters.priceMax.trim() ? Number(filters.priceMax) : undefined,
      categories: filters.categories,
      tags: filters.tags
    };
  }, [filters]);

  async function load() {
    if (!warehouse) return;
    setMsg(null);
    try {
      setLots(await api.listLots(warehouse.id, backendFilters));
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    }
  }

  useEffect(() => {
    load();
  }, [warehouse?.id]);

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [backendFilters.q, backendFilters.price_min, backendFilters.price_max, backendFilters.categories.join(","), backendFilters.tags.join(",")]);

  if (!warehouse) {
    return (
      <div className="container" style={{ marginTop: 16 }}>
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800 }}>Склад не выбран</div>
          <div className="muted">Сверху справа кнопка “Склад: …”. Выбери или создай склад.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 340, position: "sticky", top: 18 }}>
          <FilterPanel value={filters} onChange={setFilters} />
        </div>

        <div style={{ flex: 1 }} className="col">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="glass" style={{ padding: 12, width: "100%" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="col" style={{ gap: 2 }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>Хранилище</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Склад <b style={{ color: "rgba(255,255,255,0.92)" }}>{warehouse.name}</b> • лотов: {lots.length}
                  </div>
                </div>
                <div className="row">
                  <button className="btn" onClick={load}>
                    Обновить
                  </button>
                  <button className="btn primary" onClick={() => setOpen(true)} title="Добавить лот">
                    +
                  </button>
                </div>
              </div>
              {msg ? <div className="muted" style={{ marginTop: 10 }}>{msg}</div> : null}
            </div>
          </div>

          <LotTable lots={lots} onChanged={load} />
        </div>
      </div>

      {open ? (
        <LotModal
          warehouse_id={warehouse.id}
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
