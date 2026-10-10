import { NextRequest, NextResponse } from "next/server";

const DJANGO_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

async function forwardRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const baseUrl = DJANGO_API_URL.replace(/\/+$/, "");
  const cleanPath = path
    .map((seg) => seg.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  const searchParams = req.nextUrl.search || "";

  // Normalize target URL: exactly one trailing slash before query parameters, no double slashes
  const targetUrl = `${baseUrl}/${cleanPath}/${searchParams}`;

  let accessToken = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;

  const headers: Record<string, string> = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  let body: any = null;
  if (!["GET", "HEAD"].includes(req.method)) {
    const rawBody = await req.arrayBuffer();
    body = rawBody.byteLength > 0 ? Buffer.from(rawBody) : null;
  }

  // Use manual redirect handling so POST/PUT bodies are never stripped or converted to GET
  let res = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  if ([301, 302, 307, 308].includes(res.status)) {
    const redirectLocation = res.headers.get("location");
    if (redirectLocation) {
      const redirectUrl = redirectLocation.startsWith("http")
        ? redirectLocation
        : `${baseUrl}${redirectLocation.startsWith("/") ? "" : "/"}${redirectLocation}`;
      res = await fetch(redirectUrl, {
        method: req.method,
        headers,
        body,
        redirect: "manual",
      });
    }
  }

  let newAccessToken: string | null = null;
  let newRefreshToken: string | null = null;

  // Auto-refresh token if 401 and refresh_token exists
  if (res.status === 401 && refreshToken) {
    try {
      const refreshRes = await fetch(`${baseUrl}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        newAccessToken = refreshData.access;
        newRefreshToken = refreshData.refresh || null;

        // Retry original request with fresh access token preserving method and body
        headers["Authorization"] = `Bearer ${newAccessToken}`;
        res = await fetch(targetUrl, {
          method: req.method,
          headers,
          body,
          redirect: "manual",
        });

        if ([301, 302, 307, 308].includes(res.status)) {
          const redirectLocation = res.headers.get("location");
          if (redirectLocation) {
            const redirectUrl = redirectLocation.startsWith("http")
              ? redirectLocation
              : `${baseUrl}${redirectLocation.startsWith("/") ? "" : "/"}${redirectLocation}`;
            res = await fetch(redirectUrl, {
              method: req.method,
              headers,
              body,
              redirect: "manual",
            });
          }
        }
      }
    } catch {
      // Refresh failed
    }
  }

  // Handle Response
  const resContentType = res.headers.get("content-type") || "";
  const hasContentDisposition = !!res.headers.get("content-disposition");
  let responseData: any;
  if (
    hasContentDisposition ||
    resContentType.includes("application/pdf") ||
    resContentType.includes("image/") ||
    resContentType.includes("application/octet-stream") ||
    resContentType.includes("application/zip") ||
    resContentType.includes("application/vnd") ||
    resContentType.includes("application/msword")
  ) {
    responseData = await res.arrayBuffer();
  } else {
    responseData = await res.text();
  }

  const responseHeaders = new Headers();
  if (resContentType) {
    responseHeaders.set("Content-Type", resContentType);
  }
  const contentDisposition = res.headers.get("content-disposition");
  if (contentDisposition) {
    responseHeaders.set("Content-Disposition", contentDisposition);
  }

  const response = new NextResponse(responseData, {
    status: res.status,
    headers: responseHeaders,
  });

  const isProduction = process.env.NODE_ENV === "production";

  if (newAccessToken) {
    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60,
    });
  }

  if (newRefreshToken) {
    response.cookies.set("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  if (res.status === 401 && !newAccessToken) {
    // Session truly expired -> clear cookies
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("user_role");
    response.cookies.delete("user_info");
  }

  return response;
}

export const GET = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;
