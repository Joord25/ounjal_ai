import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isLoggedIn = request.cookies.get("auth_logged_in")?.value === "1";

  // 로그인 유저가 랜딩(/)에 접속하면 /app으로 리다이렉트
  if (isLoggedIn && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
