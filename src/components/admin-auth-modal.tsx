"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";

type AdminAuthModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function AdminAuthModal({
  open,
  title = "Admin password required",
  description = "Enter the admin password to continue.",
  onClose,
  onSuccess,
}: AdminAuthModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setError(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <p className="admin-help">{description}</p>
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoComplete="current-password"
            aria-label="Admin password"
          />
          <div className="admin-modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={loading || !password}>
              {loading ? "Checking…" : "Continue"}
            </button>
          </div>
        </form>
        {error && <p className="admin-error">{error}</p>}
      </div>
    </div>
  );
}

/** Returns true if the browser already has a valid admin session cookie. */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}
