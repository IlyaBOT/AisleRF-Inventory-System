import React, { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";
import baseAvatar from "../assets/base_avatar.svg";

const DEFAULT_AVATAR_URL =
  "https://raw.githubusercontent.com/IlyaBOT/BaseFastAPI-webProject/refs/heads/main/app/resources/img/base_avatar.svg";

function avatarSrc(avatar_base64?: string | null) {
  if (avatar_base64) return `data:image/jpeg;base64,${avatar_base64}`;
  return DEFAULT_AVATAR_URL || baseAvatar;
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

export function AvatarMenu() {
  const { user, logout, refreshMe } = useAuth();
  const [open, setOpen] = useState(false);
  const src = useMemo(() => avatarSrc(user?.avatar_base64), [user?.avatar_base64]);

  return (
    <>
      <div className="row" style={{ gap: 10 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          Здравствуйте, <b style={{ color: "rgba(255,255,255,0.95)" }}>{user?.username}</b>!
        </div>
        <button className="btn" onClick={() => setOpen(true)} style={{ padding: 6, borderRadius: 999 }}>
          <img
            src={src}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = baseAvatar;
            }}
            alt="avatar"
            width={34}
            height={34}
            style={{ borderRadius: 999, display: "block" }}
          />
        </button>
      </div>

      {open ? (
        <ProfileModal
          onClose={() => setOpen(false)}
          onLogout={() => {
            logout();
            setOpen(false);
          }}
          onUpdated={refreshMe}
        />
      ) : null}
    </>
  );
}

function ProfileModal({
  onClose,
  onLogout,
  onUpdated
}: {
  onClose: () => void;
  onLogout: () => void;
  onUpdated: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [username, setUsername] = useState(user?.username || "");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveUsername() {
    setBusy(true);
    setMsg(null);
    try {
      await api.updateMe(username);
      await onUpdated();
      setMsg("Ок: логин обновлен");
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    setBusy(true);
    setMsg(null);
    try {
      await api.changePassword(oldPass, newPass);
      setOldPass("");
      setNewPass("");
      setMsg("Ок: пароль обновлен");
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadAvatar(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const b64 = await fileToBase64Jpeg128(file);
      await api.changeAvatar(b64);
      await onUpdated();
      setMsg("Ок: аватар обновлен");
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAvatar() {
    setBusy(true);
    setMsg(null);
    try {
      await api.changeAvatar(null);
      await onUpdated();
      setMsg("Ок: аватар удален");
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Настройки пользователя"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={onLogout} disabled={busy}>
            Выйти
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
        </>
      }
    >
      <div className="col">
        <div className="glass-soft" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Логин</div>
          <div className="row">
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            <button className="btn primary" onClick={saveUsername} disabled={busy}>
              Сохранить
            </button>
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Пароль</div>
          <div className="row">
            <input
              className="input"
              placeholder="Старый пароль"
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
            />
            <input
              className="input"
              placeholder="Новый пароль"
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <button className="btn primary" onClick={savePassword} disabled={busy}>
              Сменить
            </button>
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Аватар</div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadAvatar(f);
                }}
              />
              <button className="btn" onClick={onDeleteAvatar} disabled={busy}>
                Удалить
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="muted">{msg}</div> : null}
      </div>
    </Modal>
  );
}
