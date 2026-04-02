import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSessionUser } from "@/lib/auth-session";
import { hashPassword, verifyPassword } from "@/lib/password";

function envAdmin() {
  return {
    username: (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD ?? "",
  };
}

export async function POST(req: Request) {
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

  if (!username || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { username } });
  const admin = envAdmin();
  if (!user && username === admin.username && admin.password && password === admin.password) {
    user = await prisma.user.create({
      data: {
        username: admin.username,
        passwordHash: hashPassword(admin.password),
        role: "ADMIN",
      },
    });
  }
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await setSessionUser({ id: user.id, username: user.username, role: user.role as "ADMIN" | "USER" });

  return NextResponse.json({ ok: true, username: user.username, role: user.role });
}
