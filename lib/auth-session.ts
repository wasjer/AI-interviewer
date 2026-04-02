import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionOptions } from "@/lib/session-options";

export type SessionPayload = {
  userId?: string;
  username?: string;
  role?: "ADMIN" | "USER";
};

export async function getAppSession(): Promise<IronSession<SessionPayload>> {
  return getIronSession<SessionPayload>(await cookies(), getSessionOptions());
}

export async function getSessionUser() {
  const session = await getAppSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true },
  });
  return user;
}

export async function setSessionUser(user: {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
}) {
  const session = await getAppSession();
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  await session.save();
}

export async function clearSession() {
  const session = await getAppSession();
  session.destroy();
}
