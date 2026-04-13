"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AnimatedHello from "@/components/AnimatedHello";

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
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length, pendingUserMsg]);

  async function send() {
    const text = input.trim();
    if (!text || !id || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setPendingUserMsg(text);
    try {
      const res = await fetch(`/api/sessions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.message === "string" ? data.message
          : typeof data.error === "string" ? data.error : "发送失败";
        throw new Error(msg);
      }
      setSession((data as { session: ApiSession }).session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
      setInput(text);
    } finally {
      setSending(false);
      setPendingUserMsg(null);
    }
  }

  if (!id) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "#f5f4ed" }}>
        <p className="text-sm" style={{ color: "#87867f" }}>无效的链接</p>
      </main>
    );
  }

  const isCompleted = session?.status === "COMPLETED";
  const displayMessages = session?.messages ?? [];

  return (
    <div className="flex h-screen flex-col" style={{ background: "#f5f4ed" }}>

      {/* Header — Near Black with warm silver text */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-3.5"
        style={{ background: "#141413", borderBottom: "1px solid #30302e" }}
      >
        <Link
          href="/"
          className="text-sm transition"
          style={{ color: "#87867f" }}
          aria-label="返回列表"
        >
          ←
        </Link>
        <h1 className="flex-1 text-center">
          <AnimatedHello
            style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#faf9f5" }}
          />
        </h1>
        <span className="w-5" />
      </header>

      {error ? (
        <div className="shrink-0 px-4 py-2 text-sm" style={{ background: "#fdf2f2", color: "#b53333" }}>
          {error}
        </div>
      ) : null}

      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {loading ? (
          <p className="text-center text-sm" style={{ color: "#87867f" }}>加载中…</p>
        ) : !session ? (
          <p className="text-center text-sm" style={{ color: "#87867f" }}>未找到会话</p>
        ) : (
          <div className="space-y-4">
            {displayMessages.map((m) =>
              m.role === "user" ? (
                /* User bubble — right, warm sand with terracotta ring */
                <div key={m.id} className="flex justify-end">
                  <div
                    className="max-w-[75%] px-4 py-3"
                    style={{
                      background: "#e8e6dc",
                      borderRadius: "16px 4px 16px 16px",
                      boxShadow: "0px 0px 0px 1px #d1cfc5",
                      color: "#141413",
                      fontSize: "20px",
                      lineHeight: "1.5",
                    }}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ) : (
                /* AI bubble — left, ivory with border cream */
                <div key={m.id} className="flex justify-start">
                  <div
                    className="max-w-[75%] px-4 py-3"
                    style={{
                      background: "#faf9f5",
                      border: "1px solid #f0eee6",
                      borderRadius: "4px 16px 16px 16px",
                      boxShadow: "rgba(0,0,0,0.05) 0px 2px 12px",
                      color: "#141413",
                      fontSize: "20px",
                      lineHeight: "1.5",
                    }}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              )
            )}

            {/* Optimistic user bubble */}
            {pendingUserMsg ? (
              <div className="flex justify-end">
                <div
                  className="max-w-[75%] px-4 py-3"
                  style={{
                    background: "#e8e6dc",
                    borderRadius: "16px 4px 16px 16px",
                    boxShadow: "0px 0px 0px 1px #d1cfc5",
                    color: "#141413",
                    fontSize: "20px",
                    lineHeight: "1.5",
                    opacity: 0.7,
                  }}
                >
                  <p className="whitespace-pre-wrap">{pendingUserMsg}</p>
                </div>
              </div>
            ) : null}

            {/* AI typing indicator */}
            {sending ? (
              <div className="flex justify-start">
                <div
                  className="px-5 py-4"
                  style={{
                    background: "#faf9f5",
                    border: "1px solid #f0eee6",
                    borderRadius: "4px 16px 16px 16px",
                    boxShadow: "rgba(0,0,0,0.05) 0px 2px 12px",
                  }}
                >
                  <span className="flex gap-1.5 items-center">
                    <span
                      className="h-2.5 w-2.5 rounded-full animate-bounce"
                      style={{ background: "#87867f", animationDelay: "0ms" }}
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full animate-bounce"
                      style={{ background: "#87867f", animationDelay: "160ms" }}
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full animate-bounce"
                      style={{ background: "#87867f", animationDelay: "320ms" }}
                    />
                  </span>
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      {!loading && session ? (
        <div
          className="shrink-0 px-4 py-3"
          style={{ background: "#faf9f5", borderTop: "1px solid #e8e6dc" }}
        >
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); void send(); }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                void send();
              }}
              disabled={sending || isCompleted}
              placeholder={isCompleted ? "访谈已结束" : "建议使用豆包语音输入法"}
              className="min-h-[44px] flex-1 resize-none overflow-hidden text-sm"
              style={{
                background: "#ffffff",
                border: "1px solid #e8e6dc",
                borderRadius: "12px",
                padding: "10px 14px",
                color: "#141413",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3898ec")}
              onBlur={(e) => (e.target.style.borderColor = "#e8e6dc")}
            />
            <button
              type="submit"
              disabled={sending || isCompleted || !input.trim()}
              className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition"
              style={{
                background: sending || isCompleted || !input.trim() ? "#d4856a" : "#c96442",
                color: "#faf9f5",
                opacity: sending || isCompleted || !input.trim() ? 0.5 : 1,
              }}
            >
              发送
            </button>
          </form>
        </div>
      ) : null}

    </div>
  );
}
