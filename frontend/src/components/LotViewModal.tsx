import React from "react";
import type { Lot } from "../api/types";
import { Modal } from "./Modal";
import { useI18n } from "../context/I18nContext";

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

export function LotViewModal({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const { t } = useI18n();
  const img = lot.image_base64 ? `data:image/jpeg;base64,${lot.image_base64}` : null;
  const docHref = lot.documentation_url ? normalizeDocumentationUrl(lot.documentation_url) : null;

  return (
    <Modal title={t("lotView.title", { uid: lot.uid })} onClose={onClose}>
      <div className="col" style={{ gap: 8 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="glass-soft" style={{ padding: 8, width: 148, flexShrink: 0 }}>
            {img ? (
              <img
                src={img}
                alt={lot.name}
                width={128}
                height={128}
                style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover", display: "block", margin: "0 auto" }}
              />
            ) : (
              <div
                className="glass-soft"
                style={{ width: 128, height: 128, margin: "0 auto", display: "grid", placeItems: "center", borderRadius: 10 }}
              >
                {t("lotTable.noData")}
              </div>
            )}
          </div>
          <div className="col" style={{ flex: 1, gap: 6 }}>
            <div><b>{t("lotTable.uid")}:</b> {lot.uid}</div>
            <div><b>{t("lotTable.name")}:</b> {lot.name}</div>
            <div><b>{t("lotTable.description")}:</b> {lot.description || t("lotTable.noData")}</div>
            <div><b>{t("lotTable.category")}:</b> {lot.categories.join(", ") || t("lotTable.noData")}</div>
            <div><b>{t("lotTable.tags")}:</b> {lot.tags.join(", ") || t("lotTable.noData")}</div>
            <div><b>{t("lotTable.quantity")}:</b> {lot.quantity}</div>
            <div><b>{t("lotTable.price")}:</b> {lot.price != null ? `${lot.price.toFixed(2)} ${lot.currency}` : t("lotTable.noData")}</div>
            <div>
              <b>{t("lotTable.source")}:</b>{" "}
              {lot.purchase_url ? (
                <a href={lot.purchase_url} target="_blank" rel="noreferrer">{lot.purchase_label || t("common.open")}</a>
              ) : (
                t("lotTable.noData")
              )}
            </div>
            <div>
              <b>{t("lotTable.docs")}:</b>{" "}
              {docHref ? (
                <a href={docHref} target="_blank" rel="noreferrer">{t("common.open")}</a>
              ) : (
                t("lotTable.noData")
              )}
            </div>
            <div><b>{t("lotView.created")}:</b> {lot.created_at || t("lotTable.noData")}</div>
            <div><b>{t("lotView.updated")}:</b> {lot.updated_at || t("lotTable.noData")}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
