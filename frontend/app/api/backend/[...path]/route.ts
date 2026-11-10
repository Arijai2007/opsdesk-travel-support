import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getRefreshToken } from "@/lib/server/auth-cookies";
import { backendFetch, refreshTokens } from "@/lib/server/backend-client";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Everything under /users, /tickets, etc. lands here (not /auth/*, which
 * has its own route handlers since those calls aren't simple authenticated
 * pass-throughs). The browser only ever sees this app's own origin —
 * BACKEND_API_URL and the Bearer token never reach client JS.
 */
async function proxy(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { path } = await params;
  const backendPath = `/${path.join("/")}${request.nextUrl.search}`;
  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const attempt = (token: string | undefined) =>
    backendFetch(backendPath, {
      method,
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

  let accessToken = await getAccessToken();

  // No access token cookie at all (expired past its own maxAge, or never
  // set) — try to refresh proactively rather than making a request we
  // already know will 401.
  if (!accessToken) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      accessToken = (await refreshTokens(refreshToken)) ?? undefined;
    }
  }

  let backendRes = await attempt(accessToken);

  // Access token cookie was present but the backend rejected it (expired
  // between requests, most commonly) — refresh once and retry once. Never
  // loop: a second 401 after a fresh token means the session is genuinely
  // over (revoked, tampered cookie), not something worth retrying into.
  if (backendRes.status === 401 && accessToken) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const newAccessToken = await refreshTokens(refreshToken);
      if (newAccessToken) {
        backendRes = await attempt(newAccessToken);
      }
    }
  }

  const responseBody = await backendRes.arrayBuffer();
  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: {
      "Content-Type": backendRes.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(backendRes.headers.has("Content-Disposition")
        ? { "Content-Disposition": backendRes.headers.get("Content-Disposition")! }
        : {}),
    },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
