import { NextRequest, NextResponse } from "next/server";

const DJANGO_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function GET(req: NextRequest) {
  let accessToken = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  // If access token is missing, attempt refresh
  if (!accessToken && refreshToken) {
    try {
      const refreshRes = await fetch(`${DJANGO_API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!refreshRes.ok) {
        const resp = NextResponse.json({ detail: "Session expired" }, { status: 401 });
        resp.cookies.delete("access_token");
        resp.cookies.delete("refresh_token");
        return resp;
      }
      const refreshData = await refreshRes.json();
      accessToken = refreshData.access;
    } catch {
      return NextResponse.json({ detail: "Authentication failed" }, { status: 401 });
    }
  }

  try {
    const res = await fetch(`${DJANGO_API_URL}/auth/me/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 401 && refreshToken) {
      // Try refresh once
      const refreshRes = await fetch(`${DJANGO_API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const retryRes = await fetch(`${DJANGO_API_URL}/auth/me/`, {
          headers: {
            Authorization: `Bearer ${refreshData.access}`,
          },
        });
        if (retryRes.ok) {
          const userData = await retryRes.json();
          const response = NextResponse.json(userData);
          const isProduction = process.env.NODE_ENV === "production";
          response.cookies.set("access_token", refreshData.access, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 60,
          });
          if (refreshData.refresh) {
            response.cookies.set("refresh_token", refreshData.refresh, {
              httpOnly: true,
              secure: isProduction,
              sameSite: "lax",
              path: "/",
              maxAge: 7 * 24 * 60 * 60,
            });
          }
          response.cookies.set("user_role", userData.role || "STAFF", {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60,
          });
          return response;
        }
      }
    }

    if (!res.ok) {
      return NextResponse.json({ detail: "Failed to fetch user" }, { status: res.status });
    }

    const userData = await res.json();
    return NextResponse.json(userData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
