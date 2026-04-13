"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Me = { username: string; role: "ADMIN" | "USER" } | null;
type UserItem = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  createdAt: string;
  _count: { sessions: number };
};

const inputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e8e6dc",
  color: "#141413",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
};

export default function AdminPage() {
  const [me, setMe] = useState<Me>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptMsg, setPromptMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = (await meRes.json()) as { user: Me };
    setMe(meData.user);
    const res = await fetch("/api/admin/users");
    if (!res.ok) throw new Error("加载用户列表失败（需管理员权限）");
    const data = (await res.json()) as { users: UserItem[] };
    setUsers(data.users);
  }, []);

  useEffect(() => {
    void (async () => {
      try { setError(null); await loadUsers(); }
      catch (e) { setError(e instanceof Error ? e.message : "加载失败"); }
    })();
  }, [loadUsers]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/prompt");
        if (!res.ok) throw new Error("加载 prompt 失败");
        const data = (await res.json()) as { content: string };
        setPrompt(data.content);
      } catch (e) {
        setPromptMsg({ ok: false, text: e instanceof Error ? e.message : "加载失败" });
      } finally {
        setPromptLoading(false);
      }
    })();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim().toLowerCase(), password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "创建用户失败");
      setNewUsername(""); setNewPassword(""); setNewRole("USER");
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "创建失败"); }
  }

  async function deleteUser(id: string, username: string) {
    if (!confirm(`确认删除用户「${username}」？所有会话数据将被删除，此操作不可恢复。`)) return;
    setDeletingId(id);
    try {
      setError(null);
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "删除失败");
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "删除失败"); }
    finally { setDeletingId(null); }
  }

  async function savePrompt(e: React.FormEvent) {
    e.preventDefault();
    setPromptSaving(true); setPromptMsg(null);
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "保存失败");
      setPromptMsg({ ok: true, text: "保存成功" });
    } catch (e) { setPromptMsg({ ok: false, text: e instanceof Error ? e.message : "保存失败" }); }
    finally { setPromptSaving(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (me && me.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: "#f5f4ed" }}>
        <p className="text-sm" style={{ color: "#5e5d59" }}>你不是管理员，无法访问此页面。</p>
        <Link href="/" className="mt-3 text-sm" style={{ color: "#c96442" }}>返回首页</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#f5f4ed" }}>
      {/* Header */}
      <header
        className="flex shrink-0 items-center justify-between px-5 py-4"
        style={{ background: "#141413", borderBottom: "1px solid #30302e" }}
      >
        <span
          style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#faf9f5" }}
        >
          管理员界面
        </span>
        <div className="flex items-center gap-4">
          <a
            href="/api/admin/export/all"
            className="text-sm"
            style={{ color: "#b0aea5" }}
          >
            导出全站 ZIP
          </a>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-sm"
            style={{ color: "#b0aea5" }}
          >
            退出
          </button>
        </div>
      </header>

      {error ? (
        <div className="px-5 py-2 text-sm" style={{ background: "#fdf2f2", color: "#b53333" }}>
          {error}
        </div>
      ) : null}

      <div className="flex-1 space-y-5 px-5 py-6">

        {/* 创建用户 */}
        <section
          className="rounded-2xl p-5"
          style={{ background: "#faf9f5", border: "1px solid #f0eee6", boxShadow: "rgba(0,0,0,0.04) 0px 4px 20px" }}
        >
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: "#87867f", letterSpacing: "0.08em" }}
          >
            创建用户
          </h2>
          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-4">
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="用户名"
              style={inputStyle}
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="密码（至少8位）"
              style={inputStyle}
              minLength={8}
              required
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "USER" | "ADMIN")}
              style={inputStyle}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              type="submit"
              className="rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: "#c96442", color: "#faf9f5" }}
            >
              创建
            </button>
          </form>
        </section>

        {/* 用户列表 */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: "#faf9f5", border: "1px solid #f0eee6", boxShadow: "rgba(0,0,0,0.04) 0px 4px 20px" }}
        >
          <h2
            className="px-5 py-3.5 text-sm font-semibold uppercase tracking-wider"
            style={{ color: "#87867f", borderBottom: "1px solid #f0eee6", letterSpacing: "0.08em" }}
          >
            用户列表
          </h2>
          <ul>
            {users.map((u, i) => (
              <li
                key={u.id}
                className="flex items-center justify-between px-5 py-3.5"
                style={i !== users.length - 1 ? { borderBottom: "1px solid #f0eee6" } : {}}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "#141413" }}>{u.username}</span>
                  <span className="ml-2 text-xs" style={{ color: "#87867f" }}>
                    {u.role} · {u._count.sessions} 场
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <a
                    href={`/api/admin/export/user/${u.id}`}
                    className="text-xs font-medium"
                    style={{ color: "#c96442" }}
                  >
                    导出数据
                  </a>
                  <button
                    type="button"
                    disabled={deletingId === u.id || u.username === me?.username}
                    onClick={() => void deleteUser(u.id, u.username)}
                    className="text-xs font-medium disabled:opacity-40"
                    style={{ color: "#b53333" }}
                  >
                    {deletingId === u.id ? "删除中…" : "删除"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Prompt 编辑器 */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: "#faf9f5", border: "1px solid #f0eee6", boxShadow: "rgba(0,0,0,0.04) 0px 4px 20px" }}
        >
          <h2
            className="px-5 py-3.5 text-sm font-semibold uppercase tracking-wider"
            style={{ color: "#87867f", borderBottom: "1px solid #f0eee6", letterSpacing: "0.08em" }}
          >
            面试官 Prompt
          </h2>
          <div className="p-5">
            {promptLoading ? (
              <p className="text-sm" style={{ color: "#87867f" }}>加载中…</p>
            ) : (
              <form onSubmit={savePrompt} className="flex flex-col gap-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={24}
                  className="w-full font-mono text-sm leading-relaxed"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e8e6dc",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    color: "#141413",
                    outline: "none",
                    resize: "vertical",
                  }}
                  spellCheck={false}
                />
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={promptSaving}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    style={{ background: "#c96442", color: "#faf9f5" }}
                  >
                    {promptSaving ? "保存中…" : "保存 Prompt"}
                  </button>
                  {promptMsg ? (
                    <span className="text-sm" style={{ color: promptMsg.ok ? "#5e5d59" : "#b53333" }}>
                      {promptMsg.text}
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
