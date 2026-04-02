"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Me = { username: string; role: "ADMIN" | "USER" } | null;
type UserItem = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  createdAt: string;
  _count: { sessions: number };
};
type SessionItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  _count: { messages: number };
};

export default function AdminPage() {
  const [me, setMe] = useState<Me>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [error, setError] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const loadUsers = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = (await meRes.json()) as { user: Me };
    setMe(meData.user);

    const res = await fetch("/api/admin/users");
    if (!res.ok) throw new Error("加载用户列表失败（需管理员权限）");
    const data = (await res.json()) as { users: UserItem[] };
    setUsers(data.users);
    if (!selectedUserId && data.users.length > 0) {
      setSelectedUserId(data.users[0]!.id);
    }
  }, [selectedUserId]);

  async function loadSessions(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/sessions`);
    if (!res.ok) throw new Error("加载会话失败");
    const data = (await res.json()) as { sessions: SessionItem[] };
    setSessions(data.sessions);
  }

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await loadUsers();
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUserId) return;
    void (async () => {
      try {
        setError(null);
        await loadSessions(selectedUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
  }, [selectedUserId]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "创建用户失败");
      setNewUsername("");
      setNewPassword("");
      setNewRole("USER");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (me && me.role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-neutral-600">你不是管理员，无法访问此页面。</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-0 flex-1 w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">管理员界面</h1>
          <p className="text-sm text-neutral-500">管理用户、查看会话并导出全员记录</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/admin/export/all"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            导出全站 ZIP
          </a>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            退出登录
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-medium">创建用户</h2>
        <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-4">
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="用户名"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="密码（至少8位）"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
            minLength={8}
            required
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "USER" | "ADMIN")}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            创建
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-lg font-medium">用户列表</h2>
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`text-left text-sm ${selectedUserId === u.id ? "font-semibold" : ""}`}
                >
                  {u.username} ({u.role}) · {u._count.sessions} 场
                </button>
                <a
                  href={`/api/admin/export/user/${u.id}`}
                  className="text-xs underline"
                >
                  导出该用户
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-lg font-medium">
            {selectedUser ? `会话列表：${selectedUser.username}` : "会话列表"}
          </h2>
          {!selectedUser ? (
            <p className="text-sm text-neutral-500">请先选择用户</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-neutral-500">该用户暂无会话</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <span>{s.id.slice(0, 8)}… · {s.status}</span>
                    <a href={`/api/sessions/${s.id}/export`} className="text-xs underline">
                      导出该会话
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(s.updatedAt).toLocaleString()} · 消息 {s._count.messages} 条
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
