import React, { useMemo, useState } from "react";
import type { Lot } from "../api/types";
import * as api from "../api/client";

function lotImg(l: Lot): string | null {
  if (!l.image_base64) return null;
  return `data:image/jpeg;base64,${l.image_base64}`;
}

export function LotTable({ lots, onChanged }: { lots: Lot[]; onChanged: () => Promise<void> }) {
  const [busyUid, setBusyUid] = useState<number | null>(null);
  const [consumeAmount, setConsumeAmount] = useState<Record<number, string>>({});

  const rows = useMemo(() => lots, [lots]);

  async function consume(uid: number) {
    const raw = consumeAmount[uid] || "1";
    const amount = Math.max(1, parseInt(raw, 10) || 1);

    setBusyUid(uid);
    try {
      await api.consumeLot(uid, amount, "ui");
      await onChanged();
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div className="glass" style={{ padding: 12 }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 86 }}>UID</th>
            <th style={{ width: 74 }}>Фото</th>
            <th>Название</th>
            <th style={{ width: 210 }}>Категории / Теги</th>
            <th style={{ width: 120 }}>Кол-во</th>
            <th style={{ width: 140 }}>Цена</th>
            <th style={{ width: 160 }}>Источник</th>
            <th style={{ width: 210 }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const img = lotImg(l);
            return (
              <tr key={l.uid}>
                <td>{l.uid}</td>
                <td>
                  {img ? (
                    <img
                      src={img}
                      width={42}
                      height={42}
                      style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)" }}
                    />
                  ) : (
                    <div
                      className="glass-soft"
                      style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center" }}
                      title="Нет фото"
                    >
                      —
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {l.tags.slice(0, 6).map((t) => (
                      <span key={t} className="chip" style={{ marginRight: 6, marginTop: 6 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {l.categories.map((c) => (
                    <span key={c} className="chip" style={{ marginRight: 6, marginTop: 6 }}>
                      {c}
                    </span>
                  ))}
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{l.quantity}</div>
                </td>
                <td className="muted">
                  {l.price != null ? `${l.price.toFixed(2)} ${l.currency}` : "—"}
                </td>
                <td>
                  {l.purchase_url ? (
                    <a href={l.purchase_url} target="_blank" rel="noreferrer">
                      {l.purchase_label || "Купить"}
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      className="input"
                      style={{ width: 72, padding: "8px 10px" }}
                      value={consumeAmount[l.uid] || "1"}
                      onChange={(e) => setConsumeAmount({ ...consumeAmount, [l.uid]: e.target.value })}
                      title="Сколько списать"
                    />
                    <button
                      className="btn danger"
                      onClick={() => consume(l.uid)}
                      disabled={busyUid === l.uid || l.quantity <= 0}
                      title="Списать (consume)"
                    >
                      −
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted" style={{ padding: 18 }}>
                Тут пока пусто. Жми <b>+</b> и добавляй первый лот.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
