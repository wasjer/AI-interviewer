"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextRaw = searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.message === "string" ? data.message : "用户名或密码不正确",
        );
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
      <h1 className="mb-6 text-xl font-semibold">登录 · 小灵访谈</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}
        <div>
          <label className="mb-1 block text-sm text-neutral-600 dark:text-neutral-400">
            用户名
          </label>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-600 dark:text-neutral-400">
            密码
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        无账号请联系管理员在后台创建。
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-0 flex-1 w-full max-w-sm flex-col justify-center px-4 py-16">
      <Suspense fallback={<p className="text-sm text-neutral-500">加载中…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
