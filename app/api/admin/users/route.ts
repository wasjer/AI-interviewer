import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { hashPassword } from "@/lib/password";

const USER_RE = /^[a-z0-9_]{3,32}$/;

export async function GET() {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const username =
    typeof body === "object" && body !== null && "username" in body
      ? String((body as { username?: unknown }).username ?? "").trim().toLowerCase()
      : "";
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String((body as { password?: unknown }).password ?? "")
      : "";
  const roleRaw =
    typeof body === "object" && body !== null && "role" in body
      ? String((body as { role?: unknown }).role ?? "USER").toUpperCase()
      : "USER";
  const role = roleRaw === "ADMIN" ? "ADMIN" : "USER";

  if (!USER_RE.test(username)) {
    return NextResponse.json(
      { error: "invalid_username", message: "用户名为 3–32 位小写字母、数字或下划线" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password", message: "密码至少 8 位" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: { username, passwordHash: hashPassword(password), role },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user: created }, { status: 201 });
}
