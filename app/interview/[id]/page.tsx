"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getModule } from "@/lib/modules";

type ApiMessage = {
  id: string;
  role: string;
  content: string;
  moduleId: number;
  createdAt: string;
};

type ApiSession = {
  id: string;
  status: string;
  moduleOrder: string;
  modulePhaseIndex: number;
  followUpsInModule: number;
  messages: ApiMessage[];
};

export default function InterviewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error("无法加载会话");
      const data = (await res.json()) as { session: ApiSession };
      setSession(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || !id || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch(`/api/sessions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "发送失败";
        throw new Error(msg);
      }
      setSession((data as { session: ApiSession }).session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  const order = session ? (JSON.parse(session.moduleOrder) as number[]) : [];
  const currentModuleId =
    session && order.length > 0 ? order[session.modulePhaseIndex] ?? order[0]! : 0;
  const currentTitle = session ? getModule(currentModuleId).title : "";

  if (!id) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-neutral-500">无效的链接</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-0 flex-1 w-full max-w-2xl flex-col px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← 返回列表
          </Link>
          <h1 className="mt-1 text-lg font-semibold">访谈进行中</h1>
          {session ? (
            <p className="text-xs text-neutral-500">
              当前模块：{currentTitle}（{session.status === "COMPLETED" ? "已完成" : "进行中"}）
            </p>
          ) : null}
        </div>
        <p className="text-xs text-neutral-500">导出由管理员在后台统一处理</p>
      </header>

      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-neutral-500">加载中…</p>
      ) : !session ? (
        <p className="text-sm text-neutral-500">未找到会话</p>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
            {session.messages.map((m) => (
              <article
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-6 bg-neutral-100 dark:bg-neutral-800"
                    : "mr-6 border border-neutral-200 dark:border-neutral-700"
                }`}
              >
                <p className="mb-1 text-xs font-medium text-neutral-500">
                  {m.role === "user" ? "受访者" : "小灵"} · 模块 {m.moduleId}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            className="sticky bottom-0 border-t border-neutral-200 bg-[var(--background)] pt-4 dark:border-neutral-800"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="msg">
              回复
            </label>
            <textarea
              id="msg"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                void send();
              }}
              disabled={sending || session.status === "COMPLETED"}
              placeholder={
                session.status === "COMPLETED"
                  ? "访谈已结束"
                  : "输入你的回答…（Enter 发送，Shift+Enter 换行）"
              }
              className="w-full resize-none rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none ring-neutral-400 focus:ring-2 dark:border-neutral-600"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={sending || session.status === "COMPLETED" || !input.trim()}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {sending ? "发送中…" : "发送"}
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
