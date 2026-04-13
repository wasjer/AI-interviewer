import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/guards";

const promptPath = path.join(process.cwd(), "lib/prompts/interviewer.txt");

export async function GET() {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const content = fs.readFileSync(promptPath, "utf-8");
  return NextResponse.json({ content });
}

export async function PUT(req: Request) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const content =
    typeof body === "object" && body !== null && "content" in body
      ? String((body as { content?: unknown }).content ?? "")
      : null;

  if (content === null || content.trim() === "") {
    return NextResponse.json({ error: "empty_content", message: "内容不能为空" }, { status: 400 });
  }

  fs.writeFileSync(promptPath, content, "utf-8");
  return NextResponse.json({ ok: true });
}
