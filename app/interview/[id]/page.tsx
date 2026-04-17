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

type Draft = {
  id: string;
  text: string;
};

export default function InterviewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftsRef = useRef<Draft[]>(drafts);
  draftsRef.current = drafts;

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
  }, [session?.messages.length, drafts.length, sending]);

  // 当 input 变化时重算 textarea 高度（含点击「修改」后的赋值）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`; // 不设上限，由 CSS max-height 兜底
  }, [input]);

  // 把当前输入追加到草稿区
  function addDraft() {
    const text = input.trim();
    if (!text) return;
    setDrafts((prev) => [...prev, { id: crypto.randomUUID(), text }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  // 修改草稿：把内容还给输入框，从草稿列表移除
  function editDraft(draft: Draft) {
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setInput(draft.text);
    textareaRef.current?.focus();
  }

  // 删除草稿
  function deleteDraft(draftId: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }

  // 真正提交所有草稿给 AI
  async function submit() {
    const current = draftsRef.current;
    if (current.length === 0 || !id || sending) return;
    setSending(true);
    setError(null);
    // 草稿保持显示，等服务端返回真实消息后再清除
    try {
      const res = await fetch(`/api/sessions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: current.map((d) => d.text) }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.message === "string" ? data.message
          : typeof data.error === "string" ? data.error : "发送失败";
        throw new Error(msg);
      }
      setSession((data as { session: ApiSession }).session);
      setDrafts([]); // 服务端已确认，草稿由真实消息接替
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  // 长按逻辑：用 CSS transition 驱动进度条，避免 setInterval 频繁重渲染
  function startHold() {
    if (drafts.length === 0 || sending) return;
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(false);
      void submit();
    }, 600);
  }

  function cancelHold() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setIsHolding(false);
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
  const canSubmit = drafts.length > 0 && !sending && !isCompleted;

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "#f5f4ed" }}>

      {/* Header */}
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

            {/* 草稿气泡 */}
            {drafts.map((draft) => (
              <div key={draft.id} className="flex flex-col items-end gap-1">
                <div
                  className="max-w-[75%] px-4 py-3"
                  style={{
                    background: "#f0ede3",
                    borderRadius: "16px 4px 16px 16px",
                    border: "1.5px dashed #b8b5a8",
                    color: "#141413",
                    fontSize: "20px",
                    lineHeight: "1.5",
                  }}
                >
                  <p className="whitespace-pre-wrap">{draft.text}</p>
                </div>
                {!sending ? (
                  <div className="flex gap-3 pr-1">
                    <button
                      onClick={() => editDraft(draft)}
                      className="text-xs transition"
                      style={{ color: "#b8b5a8" }}
                    >
                      修改
                    </button>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="text-xs transition"
                      style={{ color: "#b8b5a8" }}
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            ))}

            {/* AI 思考中动画 */}
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
                    <span className="h-2.5 w-2.5 rounded-full animate-bounce" style={{ background: "#87867f", animationDelay: "0ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full animate-bounce" style={{ background: "#87867f", animationDelay: "160ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full animate-bounce" style={{ background: "#87867f", animationDelay: "320ms" }} />
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
          className="shrink-0 px-4 py-3 space-y-2"
          style={{ background: "#faf9f5", borderTop: "1px solid #e8e6dc" }}
        >
          {/* 文字输入行 */}
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); addDraft(); }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                addDraft();
              }}
              disabled={sending || isCompleted}
              placeholder={isCompleted ? "访谈已结束" : "建议使用豆包语音输入法"}
              className="min-h-[44px] flex-1 resize-none overflow-y-auto"
              style={{
                background: "#ffffff",
                border: "1px solid #e8e6dc",
                borderRadius: "12px",
                padding: "10px 14px",
                color: "#141413",
                outline: "none",
                fontSize: "16px",
                lineHeight: "1.5",
                maxHeight: "50dvh", // 最多占屏幕一半，超出后 textarea 内部滚动
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

          {/* 提交回答长按按钮 */}
          {!isCompleted ? (
            <div className="relative overflow-hidden rounded-xl select-none"
              style={{
                background: canSubmit ? "#141413" : "#d0cfc8",
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
              onPointerDown={(e) => { if (!canSubmit) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startHold(); }}
              onPointerUp={() => cancelHold()}
              onPointerLeave={() => cancelHold()}
              onPointerCancel={() => cancelHold()}
            >
              {/* CSS transition 进度条，无 JS 轮询 */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "#3d6b3a",
                  width: isHolding ? "100%" : "0%",
                  transition: isHolding ? "width 600ms linear" : "none",
                }}
              />
              <p
                className="relative z-10 py-3 text-center text-sm font-semibold"
                style={{ color: canSubmit ? "#faf9f5" : "#87867f" }}
              >
                {drafts.length === 0
                  ? "请先输入回答"
                  : isHolding
                  ? "松手取消"
                  : `提交回答 · ${drafts.length} 条`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
