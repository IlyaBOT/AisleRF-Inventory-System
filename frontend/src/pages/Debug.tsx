import React, { useEffect, useState } from "react";
import { GlassCard } from "../components/GlassCard";
import * as api from "../api/client";

export function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    try {
      setData(await api.debugStatus());
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container" style={{ marginTop: 16 }}>
      <GlassCard title="Debug" subtitle="Доступно только в dev-режиме" right={<button className="btn" onClick={load}>Обновить</button>}>
        {msg ? <div className="muted">{msg}</div> : null}
        {data ? (
          <pre
            className="glass-soft"
            style={{ padding: 12, overflow: "auto", margin: 0 }}
          >
{JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <div className="muted">Загрузка...</div>
        )}
      </GlassCard>
    </div>
  );
}
