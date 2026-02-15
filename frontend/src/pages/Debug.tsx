import React, { useEffect, useState } from "react";
import { GlassCard } from "../components/GlassCard";
import * as api from "../api/client";
import { useI18n } from "../context/I18nContext";

export function DebugPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    try {
      setData(await api.debugStatus());
    } catch (e: any) {
      setMsg(e?.message || t("common.error"));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <GlassCard
        title={t("debug.title")}
        subtitle={t("debug.devOnly")}
        right={<button className="btn" onClick={load}>{t("common.refresh")}</button>}
      >
        {msg ? <div className="auth-error">{msg}</div> : null}
        {data ? (
          <pre className="glass-soft" style={{ padding: 12, overflow: "auto", margin: 0 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <div className="muted">{t("common.loading")}</div>
        )}
      </GlassCard>
    </div>
  );
}
