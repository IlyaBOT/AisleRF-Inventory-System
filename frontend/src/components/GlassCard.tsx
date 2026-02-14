import React from "react";
import "../styles/glass.css";

export function GlassCard({
  title,
  subtitle,
  children,
  right
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="col" style={{ gap: 2 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          {subtitle ? <div className="muted" style={{ fontSize: 12 }}>{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="hr" />
      {children}
    </div>
  );
}
