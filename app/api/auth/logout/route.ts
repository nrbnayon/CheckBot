import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear all auth cookies
  response.cookies.delete("access_token")
  response.cookies.delete("refresh_token")
  response.cookies.delete("user_info")

  return response
}
