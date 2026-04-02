import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildExportMarkdown } from "@/lib/export-md";
import { requireAdmin } from "@/lib/guards";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await ctx.params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const md = buildExportMarkdown(session);
  const filename = `interview-${id.slice(0, 8)}.md`;

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
