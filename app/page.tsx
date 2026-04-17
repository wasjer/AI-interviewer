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

      <div className="flex-1 px-5 py-6">
        {loading ? (
          <p className="py-8 text-center text-sm" style={{ color: "#87867f" }}>加载中…</p>
        ) : sessions.length > 0 ? (
          /* 已有访谈 → 直接跳转，不允许再新建 */
          <div className="space-y-3">
            <Link
              href={`/interview/${sessions[0]!.id}`}
              className="block w-full rounded-xl py-3.5 text-center text-sm font-semibold transition"
              style={{
                background: "#c96442",
                color: "#faf9f5",
                boxShadow: "rgba(201,100,66,0.25) 0px 4px 16px",
              }}
            >
              继续访谈
            </Link>
            <p className="text-center text-xs" style={{ color: "#b0aea5" }}>
              {sessions[0]!.status === "COMPLETED" ? "访谈已完成" : "上次访谈进行中"}
              {" · "}
              {new Date(sessions[0]!.updatedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          /* 从未访谈 → 新建 */
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
        )}
      </div>
    </div>
  );
}
