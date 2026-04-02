import type { SessionOptions } from "iron-session";

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

export function getSessionOptions(): SessionOptions {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");

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

export function getSessionOptionsForMiddleware(): SessionOptions {
  return getSessionOptions();
}
