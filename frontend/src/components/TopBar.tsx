import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type { Warehouse } from "../api/types";
import * as api from "../api/client";
import { AvatarMenu } from "./AvatarMenu";
import { Modal } from "./Modal";
import { useI18n } from "../context/I18nContext";

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: isActive ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
        color: "#ffffff",
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
  const { t } = useI18n();

  return (
    <div className="glass" style={{ padding: 14, marginTop: 18 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          <Tab to="/" label={t("tabs.brand")} />
          <Tab to="/storage" label={t("tabs.storage")} />
          <Tab to="/system" label={t("tabs.system")} />
          {mode === "dev" ? <Tab to="/debug" label={t("tabs.debug")} /> : null}
        </div>

        <div className="row">
          <button className="btn" onClick={() => setOpenWh(true)} title={t("topbar.changeWarehouseTitle")}>
            {warehouse
              ? t("topbar.warehouseButton", { name: warehouse.name })
              : t("topbar.warehouseButtonEmpty")}{" "}
            <span className="kbd">Ctrl</span>+<span className="kbd">K</span>
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
  const { t } = useI18n();

  async function load() {
    try {
      setItems(await api.listWarehouses());
    } catch (e: any) {
      setMsg(e?.message || t("warehouseModal.loadError"));
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
      setMsg(e?.message || t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("warehouseModal.title")}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose} disabled={busy}>
          {t("common.close")}
        </button>
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
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("warehouseModal.createTitle")}</div>
          <div className="row">
            <input
              className="input"
              placeholder={t("warehouseModal.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn primary" onClick={create} disabled={busy || !name.trim()}>
              {t("common.create")}
            </button>
          </div>
        </div>

        {msg ? <div className="auth-error">{msg}</div> : null}
      </div>
    </Modal>
  );
}
