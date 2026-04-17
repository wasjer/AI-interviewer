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

  // ── 延迟模块推进路径 ──────────────────────────────────────────────────────
  // AI 已结束上一模块，先保存用户的最后一条回答，再让 LLM 做一次自然承接，
  // 然后追加下一模块的开场白。
  if (session.pendingModuleAdvance) {
    const currentModuleId = getCurrentModuleId(order, session.modulePhaseIndex);
    const newPhaseIndex = session.modulePhaseIndex + 1;
    const nextModuleId = getCurrentModuleId(order, newPhaseIndex);
    const opener = getModule(nextModuleId).cannedOpener;

    // 先把用户的最后回答写入 DB，供 LLM 读取
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

    // 调 LLM：用专属提示让它简短回应用户的最后答案并收尾，不提新问题
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

  // ── 正常流程 ──────────────────────────────────────────────────────────────
  const currentModuleId = getCurrentModuleId(order, session.modulePhaseIndex);

  // 保存所有草稿消息
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

  const turnInput = buildMessagesForMiniMax(
    afterUser.messages,
    currentModuleId,
    afterUser.followUpsInModule,
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
