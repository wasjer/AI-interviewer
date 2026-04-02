import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLogin } from "@/lib/guards";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { user, response } = await requireLogin();
  if (!user) return response;
  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "admin_chat_disabled", message: "管理员账号不提供聊天功能，请使用 /admin 管理后台。" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}
