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
      setActionMsg(e?.message || "Ошибка списания");
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
      setActionMsg(e?.message || "Ошибка увеличения количества");
    } finally {
      setBusyUid(null);
    }
  }

  async function remove(uid: number) {
    if (!window.confirm("Удалить лот?")) return;
    setActionMsg(null);
    setBusyUid(uid);
    try {
      await api.deleteLot(uid);
      await onChanged();
    } catch (e: any) {
      setActionMsg(e?.message || "Ошибка удаления");
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
        throw new Error("Цена должна быть числом");
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
      setEditMsg(e?.message || "Ошибка сохранения");
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
      setEditMsg(e?.message || "Ошибка загрузки документации");
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
            <th>Название</th>
            <th style={{ width: 220 }}>Категория</th>
            <th style={{ width: 220 }}>Теги</th>
            <th style={{ width: 110 }}>Кол-во</th>
            <th style={{ width: 140 }}>Цена</th>
            <th style={{ width: 170 }}>Источник</th>
            <th style={{ width: 150 }}>Дока</th>
            <th style={{ width: 280 }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lot) => {
            const img = lotImg(lot);
            const categoryText = lot.categories.join(", ");
            const tagText = lot.tags.join(", ");
            const shortDescription = lot.description ? truncateChars(lot.description, 52) : null;

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
                      {lot.purchase_label || "Открыть"}
                    </a>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {lot.documentation_url ? (
                    <a href={lot.documentation_url} target="_blank" rel="noreferrer">
                      Открыть
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
                      title="Списать 1"
                    >
                      -
                    </button>
                    <button
                      className="btn"
                      onClick={() => increase(lot)}
                      disabled={busyUid === lot.uid || editBusy}
                      title="Добавить 1"
                    >
                      +
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => openEdit(lot)}
                      disabled={busyUid === lot.uid || editBusy}
                    >
                      Изменить
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => remove(lot.uid)}
                      disabled={busyUid === lot.uid || editBusy}
                      title="Удалить лот"
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
                Тут пока пусто. Жми <b>+</b> и добавляй первый лот.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {editForm ? (
        <Modal
          title={`Изменить лот #${editForm.uid}`}
          onClose={closeEdit}
          footer={
            <>
              <button className="btn" onClick={closeEdit} disabled={editBusy || editDocBusy}>Отмена</button>
              <button className="btn primary" onClick={saveEdit} disabled={editBusy || editDocBusy || !editForm.name.trim()}>
                {editBusy ? "Сохранение..." : "Сохранить"}
              </button>
            </>
          }
        >
          <div className="col" style={{ gap: 4 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Название</div>
              <input
                className="input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
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
            <div className="row" style={{ gap: 4 }}>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Цена</div>
                <input
                  className="input"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
              </div>
              <div style={{ width: 120 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Валюта</div>
                <input
                  className="input"
                  value={editForm.currency}
                  onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
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
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Описание</div>
              <textarea
                className="input"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="glass-soft" style={{ padding: 8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="muted" style={{ fontSize: 12 }}>Фото (128x128 JPEG)</div>
                <div className="row" style={{ gap: 4 }}>
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
              {editForm.image_base64 ? (
                <div style={{ marginTop: 6 }}>
                  <img
                    src={`data:image/jpeg;base64,${editForm.image_base64}`}
                    alt={editForm.name}
                    width={72}
                    height={72}
                    style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover" }}
                  />
                </div>
              ) : null}
            </div>
            {editMsg ? <div className="auth-error" role="alert">{editMsg}</div> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
