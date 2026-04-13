"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnimatedHello from "@/components/AnimatedHello";

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
      .then((d: { user?: MeUser | null }) => setMe(d.user ?? null))
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

  useEffect(() => { void load(); }, [load]);

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
    <div className="flex min-h-screen flex-col" style={{ background: "#f5f4ed" }}>
      {/* Header */}
      <header
        className="flex shrink-0 items-center justify-between px-5 py-4"
        style={{ background: "#141413", borderBottom: "1px solid #30302e" }}
      >
        <AnimatedHello
          style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#faf9f5" }}
        />
        <div className="flex items-center gap-4">
          {me ? (
            <span className="text-xs" style={{ color: "#87867f" }}>
              {me.username}
            </span>
          ) : null}
          {me?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="text-sm transition"
              style={{ color: "#b0aea5" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#faf9f5")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#b0aea5")}
            >
              管理
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="text-sm transition"
            style={{ color: "#b0aea5" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#faf9f5")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#b0aea5")}
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

      <div className="flex-1 px-5 py-6 space-y-6">
        {/* New session */}
        <button
          type="button"
          onClick={() => void createSession()}
          disabled={creating}
          className="w-full rounded-xl py-3.5 text-sm font-semibold transition"
          style={{
            background: creating ? "#d4856a" : "#c96442",
            color: "#faf9f5",
            boxShadow: "rgba(201,100,66,0.25) 0px 4px 16px",
          }}
        >
          {creating ? "正在创建…" : "新建访谈"}
        </button>

        {/* Session list */}
        <div>
          <p
            className="mb-3 text-xs font-medium uppercase tracking-widest"
            style={{ color: "#87867f", letterSpacing: "0.08em" }}
          >
            最近访谈
          </p>
          {loading ? (
            <p className="py-8 text-center text-sm" style={{ color: "#87867f" }}>加载中…</p>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "#87867f" }}>
              暂无记录，点击「新建访谈」开始
            </p>
          ) : (
            <ul
              className="overflow-hidden rounded-2xl"
              style={{
                background: "#faf9f5",
                border: "1px solid #f0eee6",
                boxShadow: "rgba(0,0,0,0.05) 0px 4px 24px",
              }}
            >
              {sessions.map((s, i) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-5 py-4"
                  style={i !== sessions.length - 1 ? { borderBottom: "1px solid #f0eee6" } : {}}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#141413" }}>
                      访谈 {s.id.slice(0, 8)}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "#87867f" }}>
                      {new Date(s.updatedAt).toLocaleString()} ·{" "}
                      {s.status === "COMPLETED" ? "已完成" : "进行中"}
                    </p>
                  </div>
                  <Link
                    href={`/interview/${s.id}`}
                    className="rounded-lg px-4 py-1.5 text-xs font-medium transition"
                    style={{
                      background: "#e8e6dc",
                      color: "#4d4c48",
                      boxShadow: "0px 0px 0px 1px #d1cfc5",
                    }}
                  >
                    打开
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
