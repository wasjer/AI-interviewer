import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildModuleOrder, getModule } from "@/lib/modules";
import { requireLogin } from "@/lib/guards";

export async function GET() {
  const { user, response } = await requireLogin();
  if (!user) return response;
  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "admin_chat_disabled", message: "管理员账号不提供聊天功能，请使用 /admin 管理后台。" },
      { status: 403 },
    );
  }

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      moduleOrder: true,
      modulePhaseIndex: true,
    },
  });
  return NextResponse.json({ sessions });
}

export async function POST() {
  const { user, response } = await requireLogin();
  if (!user) return response;
  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "admin_chat_disabled", message: "管理员账号不提供聊天功能，请使用 /admin 管理后台。" },
      { status: 403 },
    );
  }

  const order = buildModuleOrder();
  const firstModuleId = order[0]!;
  const opener = getModule(firstModuleId).cannedOpener;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      moduleOrder: JSON.stringify(order),
      modulePhaseIndex: 0,
      followUpsInModule: 0,
      status: "IN_PROGRESS",
      messages: {
        create: {
          role: "assistant",
          content: opener,
          moduleId: firstModuleId,
        },
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ session });
}
