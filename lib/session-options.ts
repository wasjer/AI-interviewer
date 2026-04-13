import type { SessionOptions } from "iron-session";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "interviewer_session";

/** 与 iron-session 解密一致，须与 middleware、Route Handler 使用同一套逻辑 */
export function getRawSessionPassword(): string {
  const p = process.env.SESSION_PASSWORD ?? "";
  if (p.length >= 32) return p;
  if (process.env.NODE_ENV !== "production") {
    return "0123456789abcdef0123456789abcdef";
  }
  throw new Error(
    "生产环境必须设置 SESSION_PASSWORD（至少 32 位）。生成：openssl rand -base64 32",
  );
}

export function isHttpsFromForwardedProto(
  header: string | null | undefined,
): boolean {
  if (!header) return false;
  return header.split(",")[0].trim().toLowerCase() === "https";
}

/**
 * 开发环境下：若反代声明 HTTPS（如 Cloudflare Tunnel 的 x-forwarded-proto），
 * 自动使用 Secure Cookie，避免手机浏览器在 https 站点丢弃会话。
 */
export function resolveCookieSecure(clientAppearsHttps: boolean): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.NODE_ENV === "production") return true;
  return clientAppearsHttps;
}

export function buildSessionOptions(clientAppearsHttps: boolean): SessionOptions {
  const secure = resolveCookieSecure(clientAppearsHttps);
  return {
    password: getRawSessionPassword(),
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    },
  };
}

export function getSessionOptionsForMiddleware(
  request: NextRequest,
): SessionOptions {
  return buildSessionOptions(
    isHttpsFromForwardedProto(request.headers.get("x-forwarded-proto")),
  );
}

export async function getSessionOptionsForRoute(): Promise<SessionOptions> {
  const h = await headers();
  return buildSessionOptions(
    isHttpsFromForwardedProto(h.get("x-forwarded-proto")),
  );
}
