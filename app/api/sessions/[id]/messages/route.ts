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

  const content =
    typeof body === "object" && body !== null && "content" in body
      ? String((body as { content?: unknown }).content ?? "").trim()
      : "";

  if (!content) {
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
  const currentModuleId = getCurrentModuleId(order, session.modulePhaseIndex);

  await prisma.message.create({
    data: {
      sessionId: id,
      role: "user",
      content,
      moduleId: currentModuleId,
    },
  });

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

  if (shouldComplete) {
    status = "COMPLETED";
  } else if (shouldAdvanceMid) {
    modulePhaseIndex = session.modulePhaseIndex + 1;
    followUpsInModule = 0;
    const nextId = getCurrentModuleId(order, modulePhaseIndex);
    replies.push({
      content: getModule(nextId).cannedOpener,
      moduleId: nextId,
    });
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
      },
    });
  });

  if (shouldComplete) {
    // 非阻塞：先入队，再在当前进程尝试消费一轮
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
