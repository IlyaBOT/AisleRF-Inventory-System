import React, { useMemo, useState } from "react";
import type { Lot } from "../api/types";
import * as api from "../api/client";
import { Modal } from "./Modal";
import { LotViewModal } from "./LotViewModal";
import { useI18n } from "../context/I18nContext";

type EditForm = {
  uid: number;
  name: string;
  categoriesRaw: string;
  tagsRaw: string;
  price: string;
  currency: string;
  purchase_url: string;
  documentation_url: string;
  description: string;
  image_base64: string | null;
};

export type LotViewMode = "compact" | "wide" | "icons";

type SortKey = "uid" | "name" | "category" | "tags" | "quantity" | "price" | "source" | "docs";
type SortDir = "asc" | "desc";

function splitTokens(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function lotImg(lot: Lot): string | null {
  if (!lot.image_base64) return null;
  return `data:image/jpeg;base64,${lot.image_base64}`;
}

function normalizeDocumentationUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isLocalNoPort = (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && !parsed.port;
    if (isLocalNoPort && parsed.pathname.startsWith("/uploads/")) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return url;
  } catch {
    return url;
  }
}

const PLACEHOLDER_IMAGE_128 = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="12" fill="#1f2937"/><rect x="12" y="12" width="104" height="104" rx="10" fill="#374151"/><path d="M30 86l22-26 16 18 10-12 20 20H30z" fill="#9ca3af"/><circle cx="50" cy="44" r="8" fill="#d1d5db"/></svg>'
)}`;

function truncateChars(text: string, maxChars: number): string {
  const compact = text.trim().replace(/\s+/g, " ");
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars).trimEnd()}...`;
}

async function fileToBase64Jpeg128(file: File): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas context");
  ctx.drawImage(img, 0, 0, 128, 128);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  return dataUrl.split(",")[1] || "";
}

export function LotTable({
  lots,
  onChanged,
  viewMode
}: {
  lots: Lot[];
  onChanged: () => Promise<void>;
  viewMode: LotViewMode;
}) {
  const { t } = useI18n();
  const [busyUid, setBusyUid] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [viewLot, setViewLot] = useState<Lot | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editDocBusy, setEditDocBusy] = useState(false);
  const [editDocFile, setEditDocFile] = useState<File | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("uid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(() => {
    const out = [...lots];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmpText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
    const cmpNumNullable = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return a - b;
    };

    out.sort((a, b) => {
      let c = 0;
      switch (sortKey) {
        case "uid":
          c = a.uid - b.uid;
          break;
        case "name":
          c = cmpText(a.name, b.name);
          break;
        case "category":
          c = cmpText(a.categories.join(", "), b.categories.join(", "));
          break;
        case "tags":
          c = cmpText(a.tags.join(", "), b.tags.join(", "));
          break;
        case "quantity":
          c = a.quantity - b.quantity;
          break;
        case "price":
          c = cmpNumNullable(a.price ?? null, b.price ?? null);
          break;
        case "source":
          c = cmpText(a.purchase_url || "", b.purchase_url || "");
          break;
        case "docs":
          c = cmpText(a.documentation_url || "", b.documentation_url || "");
          break;
      }
      return c * dir;
    });
    return out;
  }, [lots, sortKey, sortDir]);

  function toggleSort(next: SortKey) {
    if (next === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setSortDir("asc");
  }

  function sortArrow(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ^" : " v";
  }

  function openEdit(lot: Lot) {
    setEditMsg(null);
    setEditForm({
      uid: lot.uid,
      name: lot.name,
      categoriesRaw: lot.categories.join(", "),
      tagsRaw: lot.tags.join(", "),
      price: lot.price != null ? String(lot.price) : "",
      currency: lot.currency || "RUB",
      purchase_url: lot.purchase_url || "",
      documentation_url: lot.documentation_url || "",
      description: lot.description || "",
      image_base64: lot.image_base64 || null
    });
    setEditDocFile(null);
    setEditDocBusy(false);
  }

  function closeEdit() {
    if (editBusy || editDocBusy) return;
    setEditForm(null);
    setEditDocFile(null);
    setEditMsg(null);
  }

  async function decrease(uid: number) {
    setActionMsg(null);
    setBusyUid(uid);
    try {
      await api.consumeLot(uid, 1, "ui");
      await onChanged();
    } catch (e: any) {
      setActionMsg(e?.message || t("lotTable.writeOffFailed"));
    } finally {
      setBusyUid(null);
    }
  }

  async function increase(lot: Lot) {
    setActionMsg(null);
    setBusyUid(lot.uid);
    try {
      await api.updateLot(lot.uid, { quantity: lot.quantity + 1 });
      await onChanged();
    } catch (e: any) {
      setActionMsg(e?.message || t("lotTable.addOneFailed"));
    } finally {
      setBusyUid(null);
    }
  }

  async function remove(uid: number) {
    if (!window.confirm(t("lotTable.deleteConfirm"))) return;
    setActionMsg(null);
    setBusyUid(uid);
    try {
      await api.deleteLot(uid);
      await onChanged();
    } catch (e: any) {
      setActionMsg(e?.message || t("lotTable.deleteFailed"));
    } finally {
      setBusyUid(null);
    }
  }

  async function saveEdit() {
    if (!editForm || editDocBusy) return;
    setEditBusy(true);
    setEditMsg(null);
    try {
      const trimmedPrice = editForm.price.trim();
      const parsedPrice = trimmedPrice ? Number(trimmedPrice) : null;
      if (trimmedPrice && Number.isNaN(parsedPrice)) {
        throw new Error(t("lotTable.invalidPrice"));
      }
      await api.updateLot(editForm.uid, {
        name: editForm.name.trim(),
        categories: splitTokens(editForm.categoriesRaw),
        tags: splitTokens(editForm.tagsRaw),
        price: parsedPrice != null ? Math.max(0, parsedPrice) : null,
        currency: (editForm.currency.trim() || "RUB").slice(0, 8),
        purchase_url: editForm.purchase_url.trim() || null,
        documentation_url: editForm.documentation_url.trim() || null,
        description: editForm.description.trim() || null,
        image_base64: editForm.image_base64
      });
      await onChanged();
      setEditForm(null);
      setEditDocFile(null);
    } catch (e: any) {
      setEditMsg(e?.message || t("lotTable.saveFailed"));
    } finally {
      setEditBusy(false);
    }
  }

  async function uploadEditDocumentation() {
    if (!editForm || !editDocFile || editBusy || editDocBusy) return;
    setEditMsg(null);
    setEditDocBusy(true);
    try {
      const uploaded = await api.uploadLotDocumentation(editDocFile);
      setEditForm((prev) => (prev ? { ...prev, documentation_url: uploaded.url } : prev));
      setEditDocFile(null);
    } catch (e: any) {
      setEditMsg(e?.message || t("lotTable.docsUploadFailed"));
    } finally {
      setEditDocBusy(false);
    }
  }

  const isCompact = viewMode === "compact";
  const isIcons = viewMode === "icons";

  function renderNameCell(lot: Lot, shortDescription: string | null, img: string | null) {
    if (isCompact) {
      return (
        <div className="row" style={{ gap: 8, alignItems: "center", justifyContent: "flex-start" }}>
          {img ? (
            <img
              src={img}
              alt={lot.name}
              width={64}
              height={64}
              style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover", opacity: 1, cursor: "pointer", flexShrink: 0 }}
              onClick={() => setViewLot(lot)}
            />
          ) : (
            <div
              className="glass-soft"
              style={{ width: 64, height: 64, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, cursor: "pointer" }}
              onClick={() => setViewLot(lot)}
            >
              {t("lotTable.noData")}
            </div>
          )}
          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span
              style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0, maxWidth: 220 }}
              onClick={() => setViewLot(lot)}
              title={lot.name}
            >
              {lot.name}
            </span>
            <span
              className="muted"
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", minWidth: 0 }}
              onClick={() => setViewLot(lot)}
              title={lot.description || ""}
            >
              {lot.description || t("lotTable.noData")}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="col" style={{ gap: 4, alignItems: "center" }}>
        {img ? (
          <img
            src={img}
            alt={lot.name}
            width={128}
            height={128}
            style={{ borderRadius: 10, border: "2px solid rgba(255,255,255,0.14)", objectFit: "cover", opacity: 1, cursor: "pointer" }}
            onClick={() => setViewLot(lot)}
          />
        ) : (
          <div
            className="glass-soft"
            style={{ width: 128, height: 128, borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer" }}
            onClick={() => setViewLot(lot)}
          >
            {t("lotTable.noData")}
          </div>
        )}
        <div style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewLot(lot)}>{lot.name}</div>
        {shortDescription ? (
          <div
            className="muted"
            style={{ fontSize: 11, lineHeight: 1.25, cursor: "pointer", textAlign: "center" }}
            onClick={() => setViewLot(lot)}
          >
            {shortDescription}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: 4 }}>
      {actionMsg ? <div className="auth-error" role="alert">{actionMsg}</div> : null}

      {isIcons ? (
        <div className="lot-icons-grid">
          {rows.map((lot) => {
            const img = lotImg(lot);
            const documentationHref = lot.documentation_url ? normalizeDocumentationUrl(lot.documentation_url) : null;
            return (
              <div key={lot.uid} className="glass-soft lot-icon-card" onClick={() => setViewLot(lot)}>
                {img ? (
                  <img
                    src={img}
                    alt={lot.name}
                    width={128}
                    height={128}
                    style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover", display: "block", margin: "0 auto" }}
                  />
                ) : (
                  <div className="glass-soft" style={{ width: 128, height: 128, margin: "0 auto", borderRadius: 10, display: "grid", placeItems: "center" }}>
                    {t("lotTable.noData")}
                  </div>
                )}
                <div style={{ fontWeight: 800, marginTop: 8, textAlign: "center" }}>{lot.name}</div>
                <div className="muted lot-icon-desc">{lot.description || t("lotTable.noData")}</div>
                <div className="muted" style={{ fontSize: 12, textAlign: "center" }}>
                  {t("lotTable.quantity")}: {lot.quantity}
                  {lot.price != null ? ` • ${lot.price.toFixed(2)} ${lot.currency}` : ""}
                </div>
                <div className="row" style={{ gap: 4, justifyContent: "center", marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn"
                    onClick={() => decrease(lot.uid)}
                    disabled={busyUid === lot.uid || editBusy || lot.quantity <= 0}
                    title={t("lotTable.writeOffOneTitle")}
                  >
                    -
                  </button>
                  <button
                    className="btn"
                    onClick={() => increase(lot)}
                    disabled={busyUid === lot.uid || editBusy}
                    title={t("lotTable.addOneTitle")}
                  >
                    +
                  </button>
                  <button className="btn primary" onClick={() => openEdit(lot)} disabled={busyUid === lot.uid || editBusy}>
                    {t("lotTable.edit")}
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => remove(lot.uid)}
                    disabled={busyUid === lot.uid || editBusy}
                    title={t("common.delete")}
                  >
                    X
                  </button>
                </div>
                <div className="row" style={{ gap: 8, justifyContent: "center", marginTop: 4 }}>
                  {lot.purchase_url ? (
                    <a href={lot.purchase_url} target="_blank" rel="noreferrer">{lot.purchase_label || t("common.open")}</a>
                  ) : (
                    <span className="muted">{t("lotTable.noData")}</span>
                  )}
                  {documentationHref ? (
                    <a href={documentationHref} target="_blank" rel="noreferrer">{t("common.open")}</a>
                  ) : (
                    <span className="muted">{t("lotTable.noData")}</span>
                  )}
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="muted" style={{ padding: 8 }}>{t("lotTable.empty")}</div>
          ) : null}
        </div>
      ) : (
      <table className={`table lot-table-compact ${isCompact ? "lot-table-compact-mode" : ""}`}>
        <thead>
          <tr>
            <th style={{ width: 86 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("uid")}
              >
                {t("lotTable.uid")}
                {sortArrow("uid")}
              </button>
            </th>
            <th style={{ width: "25%" }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("name")}
              >
                {t("lotTable.name")}
                {sortArrow("name")}
              </button>
            </th>
            <th style={{ width: 220 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("category")}
              >
                {t("lotTable.category")}
                {sortArrow("category")}
              </button>
            </th>
            <th style={{ width: 220 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("tags")}
              >
                {t("lotTable.tags")}
                {sortArrow("tags")}
              </button>
            </th>
            <th style={{ width: 110 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("quantity")}
              >
                {t("lotTable.quantity")}
                {sortArrow("quantity")}
              </button>
            </th>
            <th style={{ width: 140 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("price")}
              >
                {t("lotTable.price")}
                {sortArrow("price")}
              </button>
            </th>
            <th style={{ width: 170 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("source")}
              >
                {t("lotTable.source")}
                {sortArrow("source")}
              </button>
            </th>
            <th style={{ width: 150 }}>
              <button
                style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}
                onClick={() => toggleSort("docs")}
              >
                {t("lotTable.docs")}
                {sortArrow("docs")}
              </button>
            </th>
            <th style={{ width: 280 }}>{t("lotTable.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lot) => {
            const img = lotImg(lot);
            const categoryText = lot.categories.join(", ");
            const tagText = lot.tags.join(", ");
            const shortDescription = lot.description ? truncateChars(lot.description, isCompact ? 180 : 128) : null;
            const documentationHref = lot.documentation_url ? normalizeDocumentationUrl(lot.documentation_url) : null;

            return (
              <tr key={lot.uid} style={isCompact ? { height: 96, maxHeight: 128 } : undefined}>
                <td>{lot.uid}</td>
                <td style={isCompact ? { maxWidth: 520 } : undefined}>
                  {renderNameCell(lot, shortDescription, img)}
                </td>
                <td
                  className="muted"
                  style={isCompact ? { fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 } : { fontSize: 11, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }}
                  title={categoryText}
                >
                  {categoryText || t("lotTable.noData")}
                </td>
                <td
                  className="muted"
                  style={isCompact ? { fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 } : { fontSize: 12, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }}
                  title={tagText}
                >
                  {tagText || t("lotTable.noData")}
                </td>
                <td style={{ fontWeight: 700 }}>{lot.quantity}</td>
                <td className="muted">
                  {lot.price != null ? `${lot.price.toFixed(2)} ${lot.currency}` : t("lotTable.noData")}
                </td>
                <td>
                  {lot.purchase_url ? (
                    <a href={lot.purchase_url} target="_blank" rel="noreferrer">
                      {lot.purchase_label || t("common.open")}
                    </a>
                  ) : (
                    <span className="muted">{t("lotTable.noData")}</span>
                  )}
                </td>
                <td>
                  {documentationHref ? (
                    <a href={documentationHref} target="_blank" rel="noreferrer">
                      {t("common.open")}
                    </a>
                  ) : (
                    <span className="muted">{t("lotTable.noData")}</span>
                  )}
                </td>
                <td>
                  <div className="col" style={{ gap: 4, alignItems: "center" }}>
                    <div className="row" style={{ gap: 4, justifyContent: "center" }}>
                      <button
                        className="btn"
                        onClick={() => decrease(lot.uid)}
                        disabled={busyUid === lot.uid || editBusy || lot.quantity <= 0}
                        title={t("lotTable.writeOffOneTitle")}
                      >
                        -
                      </button>
                      <button
                        className="btn"
                        onClick={() => increase(lot)}
                        disabled={busyUid === lot.uid || editBusy}
                        title={t("lotTable.addOneTitle")}
                      >
                        +
                      </button>
                    </div>
                    <div className="row" style={{ gap: 4, justifyContent: "center" }}>
                      <button
                        className="btn primary"
                        onClick={() => openEdit(lot)}
                        disabled={busyUid === lot.uid || editBusy}
                      >
                        {t("lotTable.edit")}
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => remove(lot.uid)}
                        disabled={busyUid === lot.uid || editBusy}
                        title={t("common.delete")}
                      >
                        X
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}

          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="muted" style={{ padding: 4 }}>
                {t("lotTable.empty")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      )}

      {viewLot ? <LotViewModal lot={viewLot} onClose={() => setViewLot(null)} /> : null}

      {editForm ? (
        <Modal
          title={t("lotTable.editTitle", { uid: editForm.uid })}
          onClose={closeEdit}
          footer={
            <>
              <button className="btn" onClick={closeEdit} disabled={editBusy || editDocBusy}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" onClick={saveEdit} disabled={editBusy || editDocBusy || !editForm.name.trim()}>
                {editBusy ? t("lotTable.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <div className="col" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
              <div
                className="glass-soft"
                style={{
                  padding: 8,
                  minWidth: 168,
                  width: "fit-content",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  boxSizing: "border-box"
                }}
              >
                <img
                  src={editForm.image_base64 ? `data:image/jpeg;base64,${editForm.image_base64}` : PLACEHOLDER_IMAGE_128}
                  alt={editForm.name || "placeholder"}
                  width={141}
                  height={141}
                  style={{ borderRadius: 10, border: "2px solid rgba(255,255,255,0.14)", objectFit: "cover", display: "block", opacity: 1 }}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 6, textAlign: "center", width: "100%" }}>
                  {t("lotModal.photoLabel")}
                </div>
                <div className="row" style={{ gap: 4, marginTop: 4, justifyContent: "center", flexWrap: "wrap", width: "100%" }}>
                  <label className="btn" style={{ margin: 0 }}>
                    {t("common.upload")}
                    <input
                      style={{ display: "none" }}
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const b64 = await fileToBase64Jpeg128(f);
                          setEditForm((prev) => (prev ? { ...prev, image_base64: b64 } : prev));
                        } catch {
                          setEditMsg(t("lotTable.imageProcessFailed"));
                        }
                      }}
                    />
                  </label>
                  <button
                    className="btn"
                    type="button"
                    disabled={editBusy || editDocBusy || !editForm.image_base64}
                    onClick={() => setEditForm({ ...editForm, image_base64: null })}
                  >
                    {t("common.remove")}
                  </button>
                </div>
              </div>

              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.nameLabel")}</div>
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotTable.description")}</div>
                  <textarea
                    className="input"
                    rows={4}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotTable.price")}</div>
                    <input
                      className="input"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    />
                  </div>
                  <div style={{ width: 140 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.currencyLabel")}</div>
                    <input
                      className="input"
                      value={editForm.currency}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 4 }}>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.categoriesLabel")}</div>
                <input
                  className="input"
                  value={editForm.categoriesRaw}
                  onChange={(e) => setEditForm({ ...editForm, categoriesRaw: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.tagsLabel")}</div>
                <input
                  className="input"
                  value={editForm.tagsRaw}
                  onChange={(e) => setEditForm({ ...editForm, tagsRaw: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.sourceLabel")}</div>
              <input
                className="input"
                value={editForm.purchase_url}
                onChange={(e) => setEditForm({ ...editForm, purchase_url: e.target.value })}
              />
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.docsLabel")}</div>
              <input
                className="input"
                value={editForm.documentation_url}
                onChange={(e) => setEditForm({ ...editForm, documentation_url: e.target.value })}
              />
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.txt,.md,.rtf,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > 10 * 1024 * 1024) {
                      setEditMsg(t("lotModal.fileTooLarge"));
                      setEditDocFile(null);
                      e.currentTarget.value = "";
                      return;
                    }
                    setEditDocFile(f);
                  }}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={uploadEditDocumentation}
                  disabled={!editDocFile || editBusy || editDocBusy}
                >
                  {editDocBusy ? t("common.loading") : t("common.upload")}
                </button>
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => {
                    setEditDocFile(null);
                    setEditForm({ ...editForm, documentation_url: "" });
                  }}
                  disabled={editBusy || editDocBusy || (!editDocFile && !editForm.documentation_url)}
                >
                  {t("common.remove")}
                </button>
              </div>
            </div>

            {editMsg ? <div className="auth-error" role="alert">{editMsg}</div> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
