import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await login(username, password);
      nav("/");
    } catch (err: any) {
      setMsg(err?.message || t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ height: "100%", display: "grid", placeItems: "center" }}>
      <div className="glass" style={{ padding: 18, width: "min(520px, 100%)" }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>{t("login.title")}</div>
        <div className="muted" style={{ marginBottom: 14 }}>
          {t("login.subtitle")}
        </div>

        <form onSubmit={submit} className="col">
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {t("login.usernameLabel")}
            </div>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {t("login.passwordLabel")}
            </div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn primary" type="submit" disabled={busy}>
            {t("login.submit")}
          </button>
        </form>

        {msg ? <div className="auth-error" role="alert">{msg}</div> : null}
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {t("login.defaultCreds")}
        </div>
      </div>
    </div>
  );
}
