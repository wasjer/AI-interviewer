import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildMessagesForMiniMax,
  getCurrentModuleId,
  MAX_LLM_TURNS_PER_MODULE,
  parseModuleOrder,
  stripControlMarkers,
} from "@/lib/interview-state";
import { getModule } from "@/lib/modules";
import { minimaxChat } from "@/lib/minimax";
import { requireLogin } from "@/lib/guards";
import { enqueueSeedJobForSession, processPendingSeedJobsForUser } from "@/lib/seed-generator";

type RouteCtx = { params: Promise<{ id: string }> };

const FEEDBACK_TRIGGER_TURNS = 15;

// 触发收集反馈时注入的提示
const FEEDBACK_REQUEST_HINT = `

（特别提示：在自然回应用户本轮内容之后，请以轻松真诚的语气顺带提一个小问题：邀请用户为这次聊天打个分，0分是完全浪费时间、不知所云、聊完心情糟透了，10分是舒服惬意、时间不知不觉就过去了、聊天同时也整理了思绪、意犹未尽。同时请他们说说对这个工具有什么建议。说明这纯粹是你个人的好奇，语气要像朋友随口一问，不要打断访谈的气氛，不要生硬。不需要输出任何模块标记。）`;

// 用户回复反馈后，AI 致谢并自然接回访谈
const FEEDBACK_ACK_HINT = `

（特别提示：用户刚刚回复了对这次聊天的评分和建议。请用 1-2 句话真诚致谢，然后自然地衔接回刚才的访谈话题，继续正常的访谈节奏，不要提任何模块标记。）`;

export async function POST(req: Request, ctx: RouteCtx) {
  const { user, response } = await requireLogin();
  if (!user) return response;
  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "admin_chat_disabled", message: "管理员账号不提供聊天功能，请使用 /admin 管理后台。" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 支持 { contents: string[] }（多条草稿）或兼容旧的 { content: string }
  const rawList =
    typeof body === "object" && body !== null
      ? "contents" in body
        ? (body as { contents?: unknown }).contents
        : "content" in body
        ? [(body as { content?: unknown }).content]
        : []
      : [];

  const contents = (Array.isArray(rawList) ? rawList : [rawList])
    .map((c) => String(c ?? "").trim())
    .filter(Boolean);

  if (contents.length === 0) {
    return NextResponse.json({ error: "empty_content" }, { status: 400 });
  }

  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (session.status === "COMPLETED") {
    return NextResponse.json({ error: "session_completed" }, { status: 400 });
  }

  const order = parseModuleOrder(session.moduleOrder);
  const newTotalTurns = session.totalUserTurns + 1;

  // ── 延迟模块推进路径 ──────────────────────────────────────────────────────
  if (session.pendingModuleAdvance) {
    const currentModuleId = getCurrentModuleId(order, session.modulePhaseIndex);
    const newPhaseIndex = session.modulePhaseIndex + 1;
    const nextModuleId = getCurrentModuleId(order, newPhaseIndex);
    const opener = getModule(nextModuleId).cannedOpener;

    for (const c of contents) {
      await prisma.message.create({
        data: { sessionId: id, role: "user", content: c, moduleId: currentModuleId },
      });
    }

    const afterUser = await prisma.session.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!afterUser) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const wrapUpHint = "\n\n（提示：用户已回答了本模块的最后一个问题。请用 1-2 句话真诚回应并自然收尾，不要再提任何新问题，也不需要输出模块标记。）";
    const turnInput = buildMessagesForMiniMax(
      afterUser.messages,
      currentModuleId,
      afterUser.followUpsInModule,
      wrapUpHint,
    );

    let wrapUpRaw: string;
    try {
      wrapUpRaw = await minimaxChat(turnInput);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      return NextResponse.json({ error: "minimax_failed", message: msg }, { status: 502 });
    }

    const { cleaned: wrapUpText } = stripControlMarkers(wrapUpRaw);
    const wrapUpStillAsking = /？/.test(wrapUpText);
    const attempts = session.pendingAdvanceAttempts;
    const shouldRetry = wrapUpStillAsking && attempts < 2;

    if (shouldRetry) {
      // LLM 违规又问了新问题；只保存承接回应，保持 pending，等用户再答一轮
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: { sessionId: id, role: "assistant", content: wrapUpText, moduleId: currentModuleId },
        });
        await tx.session.update({
          where: { id },
          data: {
            pendingAdvanceAttempts: attempts + 1,
            totalUserTurns: newTotalTurns,
          },
        });
      });

      const sessionOut = await prisma.session.findFirst({
        where: { id, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      return NextResponse.json({
        assistantMessages: [{ content: wrapUpText, moduleId: currentModuleId }],
        session: sessionOut,
      });
    }

    // LLM 正常收尾 或 已重试 2 次强制推进
    await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: { sessionId: id, role: "assistant", content: wrapUpText, moduleId: currentModuleId },
      });
      await tx.message.create({
        data: { sessionId: id, role: "assistant", content: opener, moduleId: nextModuleId },
      });
      await tx.session.update({
        where: { id },
        data: {
          modulePhaseIndex: newPhaseIndex,
          followUpsInModule: 0,
          pendingModuleAdvance: false,
          pendingAdvanceAttempts: 0,
          totalUserTurns: newTotalTurns,
        },
      });
    });

    const sessionOut = await prisma.session.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({
      assistantMessages: [
        { content: wrapUpText, moduleId: currentModuleId },
        { content: opener, moduleId: nextModuleId },
      ],
      session: sessionOut,
    });
  }

  // ── 满意度反馈收集路径 ────────────────────────────────────────────────────
  // 用户刚回复了评分和建议，AI 致谢并自然接回访谈
  if (session.feedbackPending) {
    const currentModuleId = getCurrentModuleId(order, session.modulePhaseIndex);

    for (const c of contents) {
      await prisma.message.create({
        data: { sessionId: id, role: "user", content: c, moduleId: currentModuleId },
      });
    }

    const afterUser = await prisma.session.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!afterUser) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const turnInput = buildMessagesForMiniMax(
      afterUser.messages,
      currentModuleId,
      afterUser.followUpsInModule,
      FEEDBACK_ACK_HINT,
    );

    let raw: string;
    try {
      raw = await minimaxChat(turnInput);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      return NextResponse.json({ error: "minimax_failed", message: msg }, { status: 502 });
    }

    const { cleaned } = stripControlMarkers(raw);

    await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: { sessionId: id, role: "assistant", content: cleaned, moduleId: currentModuleId },
      });
      await tx.session.update({
        where: { id },
        data: {
          feedbackPending: false,
          feedbackCollected: true,
          totalUserTurns: newTotalTurns,
          // 反馈轮次不计入模块追问次数
        },
      });
    });

    const sessionOut = await prisma.session.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({
      assistantMessages: [{ content: cleaned, moduleId: currentModuleId }],
      session: sessionOut,
    });
  }

  // ── 正常流程 ──────────────────────────────────────────────────────────────
  const currentModuleId = getCurrentModuleId(order, session.modulePhaseIndex);

  for (const c of contents) {
    await prisma.message.create({
      data: { sessionId: id, role: "user", content: c, moduleId: currentModuleId },
    });
  }

  const afterUser = await prisma.session.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!afterUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 判断是否在本轮触发满意度收集
  // 条件：达到触发轮次、尚未收集、不在收尾模块（收尾模块氛围不合适插入）
  const shouldAskFeedback =
    newTotalTurns >= FEEDBACK_TRIGGER_TURNS &&
    !session.feedbackCollected &&
    currentModuleId !== 7;

  const extraHint = shouldAskFeedback ? FEEDBACK_REQUEST_HINT : undefined;

  const turnInput = buildMessagesForMiniMax(
    afterUser.messages,
    currentModuleId,
    afterUser.followUpsInModule,
    extraHint,
  );

  let raw: string;
  try {
    raw = await minimaxChat(turnInput);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ error: "minimax_failed", message: msg }, { status: 502 });
  }

  const { cleaned, nextModule, interviewEnd } = stripControlMarkers(raw);
  const newFollowUps = afterUser.followUpsInModule + 1;

  const onClosingModule = currentModuleId === 7;
  const forceAdvance = newFollowUps >= MAX_LLM_TURNS_PER_MODULE;

  const shouldComplete =
    onClosingModule && (interviewEnd || nextModule || forceAdvance);

  const shouldAdvanceMid =
    !onClosingModule && (nextModule || forceAdvance) && session.modulePhaseIndex + 1 < order.length;

  const replies: { content: string; moduleId: number }[] = [
    { content: cleaned, moduleId: currentModuleId },
  ];

  let modulePhaseIndex = session.modulePhaseIndex;
  let followUpsInModule = newFollowUps;
  let status = session.status;
  let pendingModuleAdvance = false;

  if (shouldComplete) {
    status = "COMPLETED";
  } else if (shouldAdvanceMid) {
    const aiStillAsking = /？/.test(cleaned);
    if (aiStillAsking) {
      pendingModuleAdvance = true;
    } else {
      modulePhaseIndex = session.modulePhaseIndex + 1;
      followUpsInModule = 0;
      const nextId = getCurrentModuleId(order, modulePhaseIndex);
      replies.push({
        content: getModule(nextId).cannedOpener,
        moduleId: nextId,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const r of replies) {
      await tx.message.create({
        data: {
          sessionId: id,
          role: "assistant",
          content: r.content,
          moduleId: r.moduleId,
        },
      });
    }
    await tx.session.update({
      where: { id },
      data: {
        modulePhaseIndex,
        followUpsInModule,
        status,
        pendingModuleAdvance,
        // 刚进入 pending 或刚清除 pending 时都重置重试计数
        pendingAdvanceAttempts: 0,
        totalUserTurns: newTotalTurns,
        // 若本轮触发了反馈收集，设置等待标志
        feedbackPending: shouldAskFeedback ? true : session.feedbackPending,
      },
    });
  });

  if (shouldComplete) {
    void enqueueSeedJobForSession(id, user.id).then(() => {
      void processPendingSeedJobsForUser(user.id);
    });
  }

  const sessionOut = await prisma.session.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    assistantMessages: replies,
    session: sessionOut,
  });
}
