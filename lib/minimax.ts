import type { OpenAIStyleMessage } from "@/lib/interview-state";
import { sanitizeAssistantContent } from "@/lib/sanitize-assistant";

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

export async function minimaxChat(messages: OpenAIStyleMessage[]): Promise<string> {
  const key = process.env.MINIMAX_API_KEY?.trim();
  /** 国内控制台密钥用 api.minimaxi.com；国际站用 https://api.minimax.io/v1 */
  const base = (process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M2.1";
  const reasoningSplit = process.env.MINIMAX_REASONING_SPLIT !== "false";

  if (!key) {
    throw new Error("MINIMAX_API_KEY 未配置。请在 .env.local 中设置。");
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      ...(reasoningSplit ? { reasoning_split: true } : {}),
    }),
  });

  const rawText = await res.text();
  let data: ChatCompletionsResponse;
  try {
    data = JSON.parse(rawText) as ChatCompletionsResponse;
  } catch {
    throw new Error(`MiniMax 返回非 JSON（HTTP ${res.status}）：${rawText.slice(0, 500)}`);
  }

  if (!res.ok) {
    const msg = data.error?.message ?? rawText.slice(0, 800);
    throw new Error(`MiniMax 请求失败（${res.status}）：${msg}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("MiniMax 返回内容为空");
  }

  const cleaned = sanitizeAssistantContent(content);
  if (!cleaned.trim()) {
    throw new Error(
      "模型回复经清理后为空。可重试，或在 .env 中设置 MINIMAX_REASONING_SPLIT=false 后重启。",
    );
  }
  return cleaned;
}
