import { NextRequest, NextResponse } from "next/server";

const DJANGO_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("refresh_token")?.value;
    const accessToken = req.cookies.get("access_token")?.value;

    if (refreshToken) {
      await fetch(`${DJANGO_API_URL}/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refresh: refreshToken }),
      }).catch(() => {});
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });

    // Clear all auth cookies
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("user_role");
    response.cookies.delete("user_info");

    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("user_role");
    response.cookies.delete("user_info");
    return response;
  }
}
