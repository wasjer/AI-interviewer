import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { buildExportMarkdown } from "@/lib/export-md";
import { requireAdmin } from "@/lib/guards";

export async function GET() {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const sessions = await prisma.session.findMany({
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      user: { select: { username: true } },
    },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
  });

  const zip = new JSZip();
  if (sessions.length === 0) {
    zip.file("暂无访谈.txt", "当前账号下还没有任何访谈记录。");
  }
  for (const s of sessions) {
    const md = buildExportMarkdown(s);
    const owner = (s.user?.username ?? "unknown").replace(/[^\w.-]/g, "_");
    const name = `${owner}-interview-${s.id.slice(0, 8)}-${s.createdAt.toISOString().slice(0, 10)}.md`;
    zip.file(name.replace(/:/g, "-"), md);
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `all-interviews-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
