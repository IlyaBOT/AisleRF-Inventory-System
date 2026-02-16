import React, { useState } from "react";
import type { Warehouse } from "../api/types";
import { GlassCard } from "../components/GlassCard";
import { useI18n } from "../context/I18nContext";
import * as api from "../api/client";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SystemPage({ warehouse }: { warehouse: Warehouse | null }) {
  const { language, setLanguage, t } = useI18n();
  const [dbBusy, setDbBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dbMsg, setDbMsg] = useState<string | null>(null);

  async function onExportDb() {
    setDbBusy(true);
    setDbMsg(null);
    try {
      const { blob, filename } = await api.exportDatabase();
      saveBlob(blob, filename);
      setDbMsg(t("system.dbExportDone", { filename }));
    } catch (e: any) {
      setDbMsg(e?.message || t("common.error"));
    } finally {
      setDbBusy(false);
    }
  }

  async function onImportDb() {
    if (!importFile) {
      setDbMsg(t("system.dbSelectFile"));
      return;
    }
    if (!window.confirm(t("system.dbImportConfirm"))) return;

    setDbBusy(true);
    setDbMsg(null);
    try {
      const result = await api.importDatabase(importFile);
      const summary = Object.entries(result.imported)
        .map(([name, count]) => `${name}: ${count}`)
        .join(", ");
      setDbMsg(t("system.dbImportDone", { summary }));
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setDbMsg(e?.message || t("common.error"));
    } finally {
      setDbBusy(false);
    }
  }

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <GlassCard title={t("system.title")} subtitle={t("system.description")}>
        <div className="col">
          <div className="glass-soft" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{t("system.languageTitle")}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="muted" style={{ fontSize: 12, minWidth: 140, alignSelf: "center" }}>
                {t("system.languageLabel")}
              </label>
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "ru" | "en")}
                style={{ maxWidth: 260 }}
              >
                <option value="ru">{t("language.ru")}</option>
                <option value="en">{t("language.en")}</option>
              </select>
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{t("system.dbTitle")}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t("system.dbHint")}
            </div>
            <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={onExportDb} disabled={dbBusy}>
                {t("system.dbExport")}
              </button>
              <input
                className="input"
                type="file"
                accept=".json,application/json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                style={{ maxWidth: 360 }}
              />
              <button className="btn primary" onClick={onImportDb} disabled={dbBusy || !importFile}>
                {t("system.dbImport")}
              </button>
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{t("system.currentSection")}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t("system.currentMode")}: <b style={{ color: "#ffffff" }}>{import.meta.env.VITE_APP_MODE || "dev"}</b>
              <br />
              {t("system.warehouse")}:{" "}
              <b style={{ color: "#ffffff" }}>{warehouse?.name || t("system.warehouseNotSelected")}</b>
            </div>
          </div>

          {dbMsg ? <div className="auth-error">{dbMsg}</div> : null}
        </div>
      </GlassCard>
    </div>
  );
}
