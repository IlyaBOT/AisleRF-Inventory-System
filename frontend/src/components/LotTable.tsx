import React, { useMemo, useState } from "react";
import type { Lot } from "../api/types";
import * as api from "../api/client";
import { Modal } from "./Modal";

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

export function LotTable({ lots, onChanged }: { lots: Lot[]; onChanged: () => Promise<void> }) {
  const [busyUid, setBusyUid] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editDocBusy, setEditDocBusy] = useState(false);
  const [editDocFile, setEditDocFile] = useState<File | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  const rows = useMemo(() => lots, [lots]);

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
      setActionMsg(e?.message || "РћС€РёР±РєР° СЃРїРёСЃР°РЅРёСЏ");
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
      setActionMsg(e?.message || "РћС€РёР±РєР° СѓРІРµР»РёС‡РµРЅРёСЏ РєРѕР»РёС‡РµСЃС‚РІР°");
    } finally {
      setBusyUid(null);
    }
  }

  async function remove(uid: number) {
    if (!window.confirm("РЈРґР°Р»РёС‚СЊ Р»РѕС‚?")) return;
    setActionMsg(null);
    setBusyUid(uid);
    try {
      await api.deleteLot(uid);
      await onChanged();
    } catch (e: any) {
      setActionMsg(e?.message || "РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ");
    } finally {
      setBusyUid(null);
    }
  }

  async function saveEdit() {
    if (!editForm) return;
    if (editDocBusy) return;
    setEditBusy(true);
    setEditMsg(null);
    try {
      const trimmedPrice = editForm.price.trim();
      const parsedPrice = trimmedPrice ? Number(trimmedPrice) : null;
      if (trimmedPrice && Number.isNaN(parsedPrice)) {
        throw new Error("Р¦РµРЅР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ С‡РёСЃР»РѕРј");
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
      setEditMsg(e?.message || "РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ");
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
      setEditMsg(e?.message || "РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґРѕРєСѓРјРµРЅС‚Р°С†РёРё");
    } finally {
      setEditDocBusy(false);
    }
  }

  return (
    <div className="glass" style={{ padding: 4 }}>
      {actionMsg ? <div className="auth-error" role="alert">{actionMsg}</div> : null}

      <table className="table lot-table-compact">
        <thead>
          <tr>
            <th style={{ width: 86 }}>UID</th>
            <th style={{ width: "25%" }}>РќР°Р·РІР°РЅРёРµ</th>
            <th style={{ width: 220 }}>РљР°С‚РµРіРѕСЂРёСЏ</th>
            <th style={{ width: 220 }}>РўРµРіРё</th>
            <th style={{ width: 110 }}>РљРѕР»-РІРѕ</th>
            <th style={{ width: 140 }}>Р¦РµРЅР°</th>
            <th style={{ width: 170 }}>РСЃС‚РѕС‡РЅРёРє</th>
            <th style={{ width: 150 }}>Р”РѕРєР°</th>
            <th style={{ width: 280 }}>Р”РµР№СЃС‚РІРёСЏ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lot) => {
            const img = lotImg(lot);
            const categoryText = lot.categories.join(", ");
            const tagText = lot.tags.join(", ");
            const shortDescription = lot.description ? truncateChars(lot.description, 52) : null;
            const documentationHref = lot.documentation_url ? normalizeDocumentationUrl(lot.documentation_url) : null;

            return (
              <tr key={lot.uid}>
                <td>{lot.uid}</td>
                <td>
                  <div className="col" style={{ gap: 4, alignItems: "center" }}>
                    {img ? (
                        <img
                          src={img}
                          alt={lot.name}
                          width={72}
                          height={72}
                          style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover" }}
                        />
                    ) : (
                      <div
                        className="glass-soft"
                        style={{ width: 72, height: 72, borderRadius: 10, display: "grid", placeItems: "center" }}
                      >
                        -
                      </div>
                    )}
                    <div style={{ fontWeight: 700 }}>{lot.name}</div>
                    {shortDescription ? (
                      <div className="muted" style={{ fontSize: 11, lineHeight: 1.25 }}>
                        {shortDescription}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 11, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }}>
                  {categoryText || "-"}
                </td>
                <td className="muted" style={{ fontSize: 12, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }}>
                  {tagText || "-"}
                </td>
                <td style={{ fontWeight: 700 }}>{lot.quantity}</td>
                <td className="muted">
                  {lot.price != null ? `${lot.price.toFixed(2)} ${lot.currency}` : "-"}
                </td>
                <td>
                  {lot.purchase_url ? (
                    <a href={lot.purchase_url} target="_blank" rel="noreferrer">
                      {lot.purchase_label || "РћС‚РєСЂС‹С‚СЊ"}
                    </a>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {documentationHref ? (
                    <a href={documentationHref} target="_blank" rel="noreferrer">
                      РћС‚РєСЂС‹С‚СЊ
                    </a>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: "center" }}>
                    <button
                      className="btn danger"
                      onClick={() => decrease(lot.uid)}
                      disabled={busyUid === lot.uid || editBusy || lot.quantity <= 0}
                      title="РЎРїРёСЃР°С‚СЊ 1"
                    >
                      -
                    </button>
                    <button
                      className="btn"
                      onClick={() => increase(lot)}
                      disabled={busyUid === lot.uid || editBusy}
                      title="Р”РѕР±Р°РІРёС‚СЊ 1"
                    >
                      +
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => openEdit(lot)}
                      disabled={busyUid === lot.uid || editBusy}
                    >
                      РР·РјРµРЅРёС‚СЊ
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => remove(lot.uid)}
                      disabled={busyUid === lot.uid || editBusy}
                      title="РЈРґР°Р»РёС‚СЊ Р»РѕС‚"
                    >
                      X
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="muted" style={{ padding: 4 }}>
                РўСѓС‚ РїРѕРєР° РїСѓСЃС‚Рѕ. Р–РјРё <b>+</b> Рё РґРѕР±Р°РІР»СЏР№ РїРµСЂРІС‹Р№ Р»РѕС‚.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {editForm ? (
        <Modal
          title={`РР·РјРµРЅРёС‚СЊ Р»РѕС‚ #${editForm.uid}`}
          onClose={closeEdit}
          footer={
            <>
              <button className="btn" onClick={closeEdit} disabled={editBusy || editDocBusy}>РћС‚РјРµРЅР°</button>
              <button className="btn primary" onClick={saveEdit} disabled={editBusy || editDocBusy || !editForm.name.trim()}>
                {editBusy ? "РЎРѕС…СЂР°РЅРµРЅРёРµ..." : "РЎРѕС…СЂР°РЅРёС‚СЊ"}
              </button>
            </>
          }
        >
                    <div className="col" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
              <div className="glass-soft" style={{ padding: 8, width: 152, flexShrink: 0 }}>
                <img
                  src={editForm.image_base64 ? `data:image/jpeg;base64,${editForm.image_base64}` : PLACEHOLDER_IMAGE_128}
                  alt={editForm.name || "placeholder"}
                  width={128}
                  height={128}
                  style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover", display: "block" }}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Фото (128x128 JPEG)</div>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <label className="btn" style={{ margin: 0 }}>
                    Загрузить
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
                          setEditMsg("Не удалось обработать изображение");
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
                    Удалить
                  </button>
                </div>
              </div>

              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Название</div>
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Описание</div>
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
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Цена</div>
                    <input
                      className="input"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    />
                  </div>
                  <div style={{ width: 140 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Валюта</div>
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
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Категории (через запятую)</div>
                <input
                  className="input"
                  value={editForm.categoriesRaw}
                  onChange={(e) => setEditForm({ ...editForm, categoriesRaw: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Теги (через запятую)</div>
                <input
                  className="input"
                  value={editForm.tagsRaw}
                  onChange={(e) => setEditForm({ ...editForm, tagsRaw: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Источник (ссылка)</div>
              <input
                className="input"
                value={editForm.purchase_url}
                onChange={(e) => setEditForm({ ...editForm, purchase_url: e.target.value })}
              />
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Дока (ссылка)</div>
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
                      setEditMsg("Файл слишком большой (максимум 10 МБ)");
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
                  {editDocBusy ? "Загрузка..." : "Загрузить"}
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
                  Удалить
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

