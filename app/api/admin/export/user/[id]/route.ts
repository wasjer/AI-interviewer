import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { buildExportMarkdown } from "@/lib/export-md";
import { requireAdmin } from "@/lib/guards";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const sessions = await prisma.session.findMany({
    where: { userId: target.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const zip = new JSZip();
  if (sessions.length === 0) {
    zip.file("暂无访谈.txt", `用户 ${target.username} 暂无访谈记录。`);
  }
  for (const s of sessions) {
    const md = buildExportMarkdown(s);
    const name = `interview-${s.id.slice(0, 8)}-${s.createdAt.toISOString().slice(0, 10)}.md`;
    zip.file(name.replace(/:/g, "-"), md);
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const safeUser = target.username.replace(/[^\w.-]/g, "_");
  const filename = `interviews-${safeUser}-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
