import React from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../context/I18nContext";
import "../styles/glass.css";

export function Modal({
  title,
  children,
  onClose,
  footer
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  const modal = (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="glass modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>{title}</h3>
          <button className="btn" onClick={onClose} title={t("common.close")}>
            x
          </button>
        </div>
        <div>{children}</div>
        {footer ? <div className="hr" /> : null}
        {footer ? <div className="row" style={{ justifyContent: "flex-end" }}>{footer}</div> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
