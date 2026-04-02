import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const sessions = await prisma.session.findMany({
    where: { userId: target.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      moduleOrder: true,
      modulePhaseIndex: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ user: target, sessions });
}
