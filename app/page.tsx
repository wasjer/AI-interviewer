"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SessionRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  moduleOrder: string;
  modulePhaseIndex: number;
};

type MeUser = { username: string; role: "ADMIN" | "USER" };

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: MeUser | null }) => {
        setMe(d.user ?? null);
      })
      .catch(() => setMe(null));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("无法加载会话列表");
      const data = (await res.json()) as { sessions: SessionRow[] };
      setSessions(data.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function createSession() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      if (!res.ok) throw new Error("创建会话失败");
      const data = (await res.json()) as { session: { id: string } };
      router.push(`/interview/${data.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-0 flex-1 w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">小灵 · AI 访谈</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {me ? (
              <span className="text-neutral-500">
                用户 <span className="font-medium text-neutral-800 dark:text-neutral-200">{me.username}</span>
                {me.role === "ADMIN" ? "（管理员）" : ""}
              </span>
            ) : null}
            {me?.role === "ADMIN" ? (
              <Link
                href="/admin"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                管理员界面
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              退出登录
            </button>
          </div>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          这里是普通用户访谈界面：可以新建并查看自己的访谈，导出统一由管理员处理。
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void createSession()}
          disabled={creating}
          className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {creating ? "正在创建…" : "新建访谈"}
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">最近访谈</h2>
        {loading ? (
          <p className="text-sm text-neutral-500">加载中…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">暂无记录，点击「新建访谈」开始。</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    href={`/interview/${s.id}`}
                    className="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                  >
                    {s.id.slice(0, 8)}…
                  </Link>
                  <p className="text-xs text-neutral-500">
                    {new Date(s.updatedAt).toLocaleString()} · {s.status === "COMPLETED" ? "已完成" : "进行中"}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <Link
                    href={`/interview/${s.id}`}
                    className="text-neutral-700 hover:underline dark:text-neutral-300"
                  >
                    打开
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
