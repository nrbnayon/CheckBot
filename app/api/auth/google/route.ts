import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

// Use different scopes for development vs production
const getScopes = () => {
  const baseScopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ]

  const emailScopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
  ]

  // In development, you might want to start with fewer scopes
  return process.env.NODE_ENV === "development"
    ? [...baseScopes, "https://www.googleapis.com/auth/gmail.readonly"]
    : [...baseScopes, ...emailScopes]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: getScopes(),
      prompt: "consent",
      include_granted_scopes: true,
    })
    return NextResponse.redirect(authUrl)
  }

  try {
    const { tokens } = await oauth2Client.getAccessToken(code)
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    const response = NextResponse.redirect(new URL("/dashboard", request.url))

    // Set secure HTTP-only cookies for 30 days
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    }

    response.cookies.set("access_token", tokens.access_token!, cookieOptions)
    if (tokens.refresh_token) {
      response.cookies.set("refresh_token", tokens.refresh_token, cookieOptions)
    }
    response.cookies.set("user_info", JSON.stringify(userInfo), cookieOptions)

    return response
  } catch (error) {
    console.error("OAuth error:", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url))
  }
}
