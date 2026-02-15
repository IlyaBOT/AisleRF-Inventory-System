import React from "react";
import type { Warehouse } from "../api/types";
import { GlassCard } from "../components/GlassCard";
import { useI18n } from "../context/I18nContext";

export function SystemPage({ warehouse }: { warehouse: Warehouse | null }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <GlassCard title={t("system.title")} subtitle={t("system.description")}>
        <div className="col">
          <div className="muted">{t("system.empty")}</div>

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
            <div style={{ fontWeight: 800 }}>{t("system.currentSection")}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t("system.currentMode")}: <b style={{ color: "#ffffff" }}>{import.meta.env.VITE_APP_MODE || "dev"}</b>
              <br />
              {t("system.warehouse")}:{" "}
              <b style={{ color: "#ffffff" }}>{warehouse?.name || t("system.warehouseNotSelected")}</b>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
