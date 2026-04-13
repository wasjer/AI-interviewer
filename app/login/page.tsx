"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const GREETING = "Hello，欢迎参加这个项目～";

function Greeting() {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(GREETING.slice(0, i));
      if (i >= GREETING.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 72);
    return () => clearInterval(id);
  }, []);

  return (
    <h1
      className="mb-8 text-center leading-snug text-[#141413]"
      style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: 500, lineHeight: 1.3 }}
    >
      {displayed}
      {!done && <span className="cursor-blink ml-0.5 text-[#c96442]">|</span>}
    </h1>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextRaw = searchParams.get("next") ?? "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "用户名或密码不正确");
      }
      const isAdmin = (data as { role?: string }).role === "ADMIN";
      router.push(isAdmin ? "/admin" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Greeting />

      {/* Card */}
      <div
        className="w-full px-7 py-8"
        style={{
          background: "#faf9f5",
          border: "1px solid #f0eee6",
          borderRadius: "16px",
          boxShadow: "rgba(0,0,0,0.05) 0px 4px 24px",
        }}
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {error ? (
            <p
              className="rounded-xl px-4 py-2.5 text-sm"
              style={{ background: "#fdf2f2", color: "#b53333", border: "1px solid #f5d5d5" }}
            >
              {error}
            </p>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "#5e5d59" }}>
              用户名
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition"
              style={{
                background: "#ffffff",
                border: "1px solid #e8e6dc",
                color: "#141413",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3898ec")}
              onBlur={(e) => (e.target.style.borderColor = "#e8e6dc")}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "#5e5d59" }}>
              密码
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition"
              style={{
                background: "#ffffff",
                border: "1px solid #e8e6dc",
                color: "#141413",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3898ec")}
              onBlur={(e) => (e.target.style.borderColor = "#e8e6dc")}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl py-3 text-sm font-semibold transition"
            style={{
              background: loading ? "#d4856a" : "#c96442",
              color: "#faf9f5",
              boxShadow: "rgba(201,100,66,0.3) 0px 4px 16px",
            }}
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs" style={{ color: "#87867f" }}>
          无账号请联系管理员在后台创建
        </p>
        <p className="mt-2 text-center text-xs" style={{ color: "#b0aea5" }}>
          v1.0.0
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{ background: "#f5f4ed" }}
    >
      <div className="w-full max-w-sm">
        <Suspense fallback={<p className="text-sm" style={{ color: "#87867f" }}>加载中…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
