import React, { useMemo, useState } from "react";
import { Modal } from "./Modal";
import * as api from "../api/client";
import type { Lot } from "../api/types";

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

function splitTokens(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function LotModal({
  warehouse_id,
  onClose,
  onCreated
}: {
  warehouse_id: number;
  onClose: () => void;
  onCreated: (lot: Lot) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [description, setDescription] = useState("");
  const [purchase_url, setPurchaseUrl] = useState("");
  const [documentationInput, setDocumentationInput] = useState("");
  const [documentationFile, setDocumentationFile] = useState<File | null>(null);
  const [documentation_url, setDocumentationUrl] = useState<string | null>(null);
  const [categoriesRaw, setCategoriesRaw] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const imgSrc = useMemo(() => (imageB64 ? `data:image/jpeg;base64,${imageB64}` : null), [imageB64]);

  async function addDocumentation() {
    if (busy || docBusy) return;
    setMsg(null);

    if (!documentationInput.trim() && !documentationFile) {
      setMsg("Укажите ссылку или выберите файл даташита");
      return;
    }

    setDocBusy(true);
    try {
      if (documentationFile) {
        const uploaded = await api.uploadLotDocumentation(documentationFile);
        setDocumentationUrl(uploaded.url);
        setDocumentationFile(null);
        setDocumentationInput("");
      } else {
        setDocumentationUrl(documentationInput.trim());
        setDocumentationInput("");
      }
    } catch (e: any) {
      setMsg(e?.message || "Ошибка загрузки документации");
    } finally {
      setDocBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        warehouse_id,
        name,
        quantity: Math.max(0, parseInt(quantity, 10) || 0),
        price: price.trim() ? Math.max(0, Number(price)) : null,
        currency,
        description: description.trim() || null,
        purchase_url: purchase_url.trim() || null,
        documentation_url: documentation_url || documentationInput.trim() || null,
        categories: splitTokens(categoriesRaw),
        tags: splitTokens(tagsRaw),
        image_base64: imageB64
      };
      const lot = await api.createLot(payload);
      onCreated(lot);
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Создание лота"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy || docBusy}>
            Отменить
          </button>
          <button className="btn primary" onClick={create} disabled={busy || docBusy || !name.trim()}>
            Добавить
          </button>
        </>
      }
    >
      <div className="col">
        <div className="row">
          <div style={{ flex: 2 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Название</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Количество</div>
            <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Цена (опц.)</div>
            <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Валюта</div>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Описание (опц.)</div>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Короткое описание компонента"
            style={{ resize: "vertical" }}
          />
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Источник покупки (ссылка)</div>
          <input
            className="input"
            placeholder="https://ozon.ru/t/..."
            value={purchase_url}
            onChange={(e) => setPurchaseUrl(e.target.value)}
          />
        </div>

        <div className="glass-soft" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Документация / даташит (опц.)</div>
          <div className="col">
            <input
              className="input"
              placeholder="https://example.com/datasheet.pdf"
              value={documentationInput}
              onChange={(e) => setDocumentationInput(e.target.value)}
            />
            <input
              className="input"
              type="file"
              accept=".pdf,.txt,.md,.rtf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > 10 * 1024 * 1024) {
                  setMsg("Файл слишком большой (максимум 10 МБ)");
                  setDocumentationFile(null);
                  e.currentTarget.value = "";
                  return;
                }
                setDocumentationFile(f);
              }}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn primary" type="button" onClick={addDocumentation} disabled={busy || docBusy}>
                {docBusy ? "Загрузка..." : "Добавить"}
              </button>
              {documentation_url ? (
                <div className="row" style={{ gap: 8 }}>
                  <a href={documentation_url} target="_blank" rel="noreferrer">Открыть</a>
                  <button className="btn" type="button" onClick={() => setDocumentationUrl(null)} disabled={busy || docBusy}>
                    Удалить
                  </button>
                </div>
              ) : (
                <span className="muted">Пока не добавлено</span>
              )}
            </div>
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Категории (через запятую)</div>
            <input
              className="input"
              placeholder="Корпуса, МК, Резисторы..."
              value={categoriesRaw}
              onChange={(e) => setCategoriesRaw(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Теги (через запятую)</div>
            <input
              className="input"
              placeholder="ATX, RGB, USB Type-C..."
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
            />
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Фото</div>
              <div className="muted" style={{ fontSize: 12 }}>
                128x128, JPEG 70% (делается на клиенте)
              </div>
            </div>
            <div className="row">
              <label className="btn">
                Загрузить
                <input
                  style={{ display: "none" }}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const b64 = await fileToBase64Jpeg128(f);
                    setImageB64(b64);
                  }}
                />
              </label>
              {imageB64 ? (
                <button className="btn" onClick={() => setImageB64(null)}>
                  Удалить
                </button>
              ) : null}
            </div>
          </div>

          {imgSrc ? (
            <div style={{ marginTop: 10 }}>
              <img src={imgSrc} width={128} height={128} style={{ borderRadius: 18 }} />
            </div>
          ) : null}
        </div>

        {msg ? <div className="auth-error" role="alert">{msg}</div> : null}
      </div>
    </Modal>
  );
}
