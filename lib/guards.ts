import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-session";

export async function requireLogin() {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null as null,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { user, response: null as null };
}

export async function requireAdmin() {
  const { user, response } = await requireLogin();
  if (!user) {
    return { user: null as null, response };
  }
  if (user.role !== "ADMIN") {
    return {
      user: null as null,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { user, response: null as null };
}
