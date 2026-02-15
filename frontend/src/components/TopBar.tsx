import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import type { Warehouse } from "../api/types";
import * as api from "../api/client";
import { AvatarMenu } from "./AvatarMenu";
import { Modal } from "./Modal";

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.92)",
        textDecoration: "none"
      })}
    >
      {label}
    </NavLink>
  );
}

export function TopBar({
  warehouse,
  setWarehouse
}: {
  warehouse: Warehouse | null;
  setWarehouse: (w: Warehouse) => void;
}) {
  const mode = import.meta.env.VITE_APP_MODE || "dev";
  const [openWh, setOpenWh] = useState(false);

  return (
    <div className="glass" style={{ padding: 14, marginTop: 18 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          <Tab to="/" label="AisleRF" />
          <Tab to="/storage" label="Хранилище" />
          <Tab to="/system" label="Система" />
          {mode === "dev" ? <Tab to="/debug" label="Debug" /> : null}
        </div>

        <div className="row">
          <button className="btn" onClick={() => setOpenWh(true)} title="Сменить склад">
            {warehouse ? `Склад: ${warehouse.name}` : "Склад: …"} <span className="kbd">Ctrl</span>+<span className="kbd">K</span>
          </button>
          <AvatarMenu />
        </div>
      </div>

      {openWh ? (
        <WarehouseModal
          onClose={() => setOpenWh(false)}
          onPick={(w) => {
            setWarehouse(w);
            setOpenWh(false);
          }}
        />
      ) : null}
    </div>
  );
}

function WarehouseModal({
  onClose,
  onPick
}: {
  onClose: () => void;
  onPick: (w: Warehouse) => void;
}) {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api.listWarehouses());
    } catch (e: any) {
      setMsg(e?.message || "Ошибка загрузки складов");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const w = await api.createWarehouse(name);
      setName("");
      await load();
      onPick(w);
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Выбор склада"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
        </>
      }
    >
      <div className="col">
        <div className="row" style={{ flexWrap: "wrap" }}>
          {items.map((w) => (
            <button key={w.id} className="btn primary" onClick={() => onPick(w)} disabled={busy}>
              {w.name}
            </button>
          ))}
        </div>

        <div className="glass-soft" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Создать склад</div>
          <div className="row">
            <input className="input" placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary" onClick={create} disabled={busy || !name.trim()}>
              Создать
            </button>
          </div>
        </div>

        {msg ? <div className="muted">{msg}</div> : null}
      </div>
    </Modal>
  );
}
