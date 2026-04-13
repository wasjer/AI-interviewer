import { getIronSession } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionOptionsForMiddleware } from "@/lib/session-options";

type SessionData = { userId?: string; username?: string; role?: "ADMIN" | "USER" };

const publicPaths = new Set(["/login", "/register"]);

function isPublicPath(pathname: string) {
  if (publicPaths.has(pathname)) return true;
  return false;
}

const publicApis = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/register-available",
]);

function isPublicApi(pathname: string) {
  return publicApis.has(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:ico|png|jpg|jpeg|svg|webp|gif)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  try {
    const session = await getIronSession<SessionData>(
      request,
      response,
      getSessionOptionsForMiddleware(request),
    );
    if (!session.userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role === "ADMIN" && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
