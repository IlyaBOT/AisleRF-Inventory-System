import React from "react";
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
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="glass modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>{title}</h3>
          <button className="btn" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer ? <div className="hr" /> : null}
        {footer ? <div className="row" style={{ justifyContent: "flex-end" }}>{footer}</div> : null}
      </div>
    </div>
  );
}
