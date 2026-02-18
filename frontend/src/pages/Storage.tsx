import React, { useEffect, useMemo, useState } from "react";
import type { Lot, Warehouse } from "../api/types";
import * as api from "../api/client";
import { FilterPanel, type Filters } from "../components/FilterPanel";
import { LotTable, type LotViewMode } from "../components/LotTable";
import { LotModal } from "../components/LotModal";
import { useI18n } from "../context/I18nContext";

function safeName(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "export";
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function saveText(content: string, filename: string, mime: string, withUtf8Bom = false) {
  const encoded = new TextEncoder().encode(content);
  const bytes = withUtf8Bom ? [0xef, 0xbb, 0xbf, ...Array.from(encoded)] : Array.from(encoded);
  const payload = new Uint8Array(bytes);
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function StoragePage({ warehouse }: { warehouse: Warehouse | null }) {
  const { t } = useI18n();
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
  const [exportOpen, setExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<LotViewMode>("wide");

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
      setMsg(e?.message || t("common.error"));
    }
  }

  useEffect(() => {
    load();
  }, [warehouse?.id]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 250);
    return () => clearTimeout(timer);
  }, [
    backendFilters.q,
    backendFilters.price_min,
    backendFilters.price_max,
    backendFilters.categories.join(","),
    backendFilters.tags.join(",")
  ]);

  function exportLots(format: "csv" | "txt") {
    if (!warehouse) return;

    const headers = [
      t("lotTable.uid"),
      t("lotTable.name"),
      t("lotTable.category"),
      t("lotTable.tags"),
      t("lotTable.quantity"),
      t("lotTable.price"),
      t("lotTable.source"),
      t("lotTable.docs")
    ];

    const rows = lots.map((lot) => [
      lot.uid,
      lot.name,
      lot.categories.join(", "),
      lot.tags.join(", "),
      lot.quantity,
      lot.price != null ? `${lot.price.toFixed(2)} ${lot.currency}` : "-",
      lot.purchase_url || "-",
      lot.documentation_url || "-"
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `${safeName(warehouse.name)}_lots_${timestamp}`;

    if (format === "csv") {
      const delimiter = ";";
      const csv = [
        `sep=${delimiter}`,
        headers.map(csvCell).join(delimiter),
        ...rows.map((r) => r.map(csvCell).join(delimiter))
      ].join("\r\n");
      saveText(csv, `${baseName}.csv`, "text/csv;charset=utf-8", true);
      return;
    }

    const txt = [headers.join(" | "), ...rows.map((r) => r.join(" | "))].join("\r\n");
    saveText(txt, `${baseName}.txt`, "text/plain;charset=utf-8", true);
  }

  if (!warehouse) {
    return (
      <div className="container" style={{ marginTop: 16 }}>
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800 }}>{t("storage.warehouseMissingTitle")}</div>
          <div className="muted">{t("storage.warehouseMissingSubtitle")}</div>
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
            <div className="glass" style={{ padding: 12, width: "100%", position: "relative", zIndex: 30, overflow: "visible" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="col" style={{ gap: 2 }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{t("storage.title")}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("storage.lotsInfo", { name: warehouse.name, count: lots.length })}
                  </div>
                </div>
                <div className="row">
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className={`btn ${viewMode === "compact" ? "primary" : ""}`}
                      onClick={() => setViewMode("compact")}
                    >
                      {t("storage.viewCompact")}
                    </button>
                    <button
                      className={`btn ${viewMode === "wide" ? "primary" : ""}`}
                      onClick={() => setViewMode("wide")}
                    >
                      {t("storage.viewWide")}
                    </button>
                    <button
                      className={`btn ${viewMode === "icons" ? "primary" : ""}`}
                      onClick={() => setViewMode("icons")}
                    >
                      {t("storage.viewIcons")}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <button className="btn" onClick={() => setExportOpen((v) => !v)}>
                      {t("storage.exportMenu")}
                    </button>
                    {exportOpen ? (
                      <div
                        className="glass-soft"
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 4px)",
                          padding: 6,
                          zIndex: 2000,
                          minWidth: 140
                        }}
                      >
                        <button
                          className="btn"
                          style={{ width: "100%", marginBottom: 4 }}
                          onClick={() => {
                            exportLots("csv");
                            setExportOpen(false);
                          }}
                        >
                          {t("storage.exportCsv")}
                        </button>
                        <button
                          className="btn"
                          style={{ width: "100%" }}
                          onClick={() => {
                            exportLots("txt");
                            setExportOpen(false);
                          }}
                        >
                          {t("storage.exportTxt")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button className="btn" onClick={load}>
                    {t("common.refresh")}
                  </button>
                  <button className="btn primary" onClick={() => setOpen(true)} title={t("storage.addLotTitle")}>
                    +
                  </button>
                </div>
              </div>
              {msg ? <div className="auth-error" style={{ marginTop: 10 }}>{msg}</div> : null}
            </div>
          </div>

          <LotTable lots={lots} onChanged={load} viewMode={viewMode} />
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
