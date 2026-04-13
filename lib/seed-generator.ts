import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type SeedPayload = {
  basicInfo: Record<string, unknown>;
  soulSeed: Record<string, unknown>;
  eventsSeed: Record<string, unknown>;
};

function minimaxConfig() {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const base = (process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M2.1";
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY 未配置，无法生成 seed profile");
  }
  return { apiKey, base, model };
}

function transcriptForSeed(messages: Array<{ role: string; moduleId: number; content: string }>): string {
  return messages
    .map((m) => `[模块${m.moduleId}] ${m.role === "user" ? "受访者" : "访谈者"}: ${m.content}`)
    .join("\n");
}

function buildSeedPrompt(transcript: string) {
  return [
    {
      role: "system",
      content:
        "你是一个专业的人物档案分析师。请基于访谈记录提炼结构化档案。仅依据文本证据，不得臆测；证据不足时写“信息不足”。只输出 JSON，不要 markdown。",
    },
    {
      role: "user",
      content: `请输出如下 JSON 结构：
{
  "basicInfo": {
    "age": "string|信息不足",
    "city": "string|信息不足",
    "occupation": "string|信息不足",
    "familyContext": "string",
    "currentLifeSummary": "string"
  },
  "soulSeed": {
    "coreValues": ["string"],
    "coreTensions": ["家庭期望_vs个人意愿|稳定安全_vs冒险发展|面子与他人眼光_vs内心真实|集体归属_vs个人边界|其他"],
    "emotionStyle": "用中文日常语言描述",
    "personalityClues": ["基于文本证据的性格线索"]
  },
  "eventsSeed": [
    {
      "title": "事件标题",
      "timeHint": "可为空",
      "summary": "事件描述（保留具体细节）",
      "impact": "对其价值观/选择的影响",
      "topicAxis": ["高考|大城市打拼|家庭责任|婚育压力|买房压力|职场规则|健康事件|迁移|其他"],
      "evidenceQuote": "对应原话片段"
    }
  ]
}

要求：
1) 全中文表达，避免翻译腔；2) 不使用西方量表术语；3) 价值观描述符合中国语境；
4) 必须保留事件细节；5) 输出必须是可解析 JSON。

访谈记录如下：
${transcript}`,
    },
  ];
}

function extractJson(text: string): SeedPayload {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("seed 生成结果不是 JSON");
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<SeedPayload>;
  if (!parsed.basicInfo || !parsed.soulSeed || !parsed.eventsSeed) {
    throw new Error("seed 生成结果缺少字段");
  }
  return {
    basicInfo: parsed.basicInfo as Record<string, unknown>,
    soulSeed: parsed.soulSeed as Record<string, unknown>,
    eventsSeed: parsed.eventsSeed as Record<string, unknown>,
  };
}

async function callMiniMaxForSeed(transcript: string): Promise<SeedPayload> {
  const { apiKey, base, model } = minimaxConfig();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildSeedPrompt(transcript),
      temperature: 0.2,
      max_tokens: 2500,
      reasoning_split: true,
      response_format: { type: "json_object" },
    }),
  });

  const txt = await res.text();
  let json: { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };
  try {
    json = JSON.parse(txt) as typeof json;
  } catch {
    throw new Error(`seed 请求返回非 JSON: ${txt.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(json.error?.message ?? `seed 请求失败: ${res.status}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("seed 返回为空");
  return extractJson(content);
}

export async function enqueueSeedJobForSession(sessionId: string, userId: string): Promise<void> {
  await prisma.seedJob.upsert({
    where: { sessionId },
    update: {},
    create: {
      sessionId,
      userId,
      status: "PENDING",
    },
  });
}

export async function processPendingSeedJobsForUser(userId: string): Promise<void> {
  const pending = await prisma.seedJob.findFirst({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (!pending) return;

  const lock = await prisma.seedJob.updateMany({
    where: { id: pending.id, status: "PENDING" },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (lock.count === 0) return;

  try {
    const session = await prisma.session.findUnique({
      where: { id: pending.sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) throw new Error("session_not_found");
    if (session.status !== "COMPLETED") throw new Error("session_not_completed");

    const transcript = transcriptForSeed(
      session.messages.map((m) => ({ role: m.role, moduleId: m.moduleId, content: m.content })),
    );
    const payload = await callMiniMaxForSeed(transcript);

    const latest = await prisma.seedProfile.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    await prisma.seedProfile.create({
      data: {
        userId,
        version: nextVersion,
        basicInfo: payload.basicInfo as Prisma.InputJsonValue,
        soulSeed: payload.soulSeed as Prisma.InputJsonValue,
        eventsSeed: payload.eventsSeed as Prisma.InputJsonValue,
        sourceSessionIds: [session.id] as Prisma.InputJsonValue,
        sourceSessionCount: 1,
      },
    });

    await prisma.seedJob.update({
      where: { id: pending.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    await prisma.seedJob.update({
      where: { id: pending.id },
      data: {
        status: "FAILED",
        lastError: message.slice(0, 1000),
        finishedAt: new Date(),
      },
    });
  }
}
