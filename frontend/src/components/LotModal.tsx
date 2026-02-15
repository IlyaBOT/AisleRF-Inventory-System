import React, { useMemo, useState } from "react";
import { Modal } from "./Modal";
import * as api from "../api/client";
import type { Lot } from "../api/types";
import { useI18n } from "../context/I18nContext";

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

const PLACEHOLDER_IMAGE_128 = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="12" fill="#1f2937"/><rect x="12" y="12" width="104" height="104" rx="10" fill="#374151"/><path d="M30 86l22-26 16 18 10-12 20 20H30z" fill="#9ca3af"/><circle cx="50" cy="44" r="8" fill="#d1d5db"/></svg>'
)}`;

export function LotModal({
  warehouse_id,
  onClose,
  onCreated
}: {
  warehouse_id: number;
  onClose: () => void;
  onCreated: (lot: Lot) => void;
}) {
  const { t } = useI18n();
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
      setMsg(t("lotModal.docsChooseInput"));
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
      setMsg(e?.message || t("lotModal.docsAddError"));
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
      setMsg(e?.message || t("lotModal.createError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("lotModal.titleCreate")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy || docBusy}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" onClick={create} disabled={busy || docBusy || !name.trim()}>
            {t("common.add")}
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
              src={imgSrc || PLACEHOLDER_IMAGE_128}
              alt={name || t("lotModal.photoAlt")}
              width={141}
              height={141}
              style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover", display: "block", opacity: 1 }}
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
                    const b64 = await fileToBase64Jpeg128(f);
                    setImageB64(b64);
                  }}
                />
              </label>
              <button className="btn" onClick={() => setImageB64(null)} disabled={!imageB64}>
                {t("common.remove")}
              </button>
            </div>
          </div>

          <div className="col" style={{ gap: 4, flex: 1 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.nameLabel")}</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.descriptionLabel")}</div>
              <textarea
                className="input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("lotModal.descriptionPlaceholder")}
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="row" style={{ gap: 4 }}>
              <div style={{ width: 120 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.quantityLabel")}</div>
                <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.priceLabel")}</div>
                <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div style={{ width: 140 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.currencyLabel")}</div>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 4 }}>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.categoriesLabel")}</div>
            <input
              className="input"
              placeholder={t("lotModal.categoriesPlaceholder")}
              value={categoriesRaw}
              onChange={(e) => setCategoriesRaw(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.tagsLabel")}</div>
            <input
              className="input"
              placeholder={t("lotModal.tagsPlaceholder")}
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.sourceLabel")}</div>
          <input
            className="input"
            placeholder={t("lotModal.sourcePlaceholder")}
            value={purchase_url}
            onChange={(e) => setPurchaseUrl(e.target.value)}
          />
        </div>

        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t("lotModal.docsLabel")}</div>
          <input
            className="input"
            placeholder={t("lotModal.docsPlaceholder")}
            value={documentation_url ?? documentationInput}
            onChange={(e) => {
              setDocumentationInput(e.target.value);
              if (documentation_url) setDocumentationUrl(null);
            }}
          />
          <div className="row" style={{ gap: 4, marginTop: 4 }}>
            <input
              className="input"
              type="file"
              accept=".pdf,.txt,.md,.rtf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > 10 * 1024 * 1024) {
                  setMsg(t("lotModal.fileTooLarge"));
                  setDocumentationFile(null);
                  e.currentTarget.value = "";
                  return;
                }
                setDocumentationFile(f);
              }}
            />
            <button className="btn" type="button" onClick={addDocumentation} disabled={busy || docBusy}>
              {docBusy ? t("common.loading") : t("common.add")}
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                setDocumentationUrl(null);
                setDocumentationInput("");
                setDocumentationFile(null);
              }}
              disabled={busy || docBusy || (!documentation_url && !documentationInput.trim() && !documentationFile)}
            >
              {t("common.remove")}
            </button>
          </div>
          {documentation_url ? (
            <div style={{ marginTop: 4 }}>
              <a href={documentation_url} target="_blank" rel="noreferrer">
                {t("common.open")}
              </a>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {t("lotModal.docsNone")}
            </div>
          )}
        </div>

        {msg ? <div className="auth-error" role="alert">{msg}</div> : null}
      </div>
    </Modal>
  );
}
