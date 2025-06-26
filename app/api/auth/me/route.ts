import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value
    const refreshToken = request.cookies.get("refresh_token")?.value
    const userInfo = request.cookies.get("user_info")?.value
    const tokenExpiry = request.cookies.get("token_expiry")?.value

    if (!accessToken || !userInfo) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )

    // Check if token is expired
    const now = Date.now()
    const expiryTime = tokenExpiry ? Number.parseInt(tokenExpiry) : now + 3600000 // Default 1 hour

    if (now >= expiryTime && refreshToken) {
      // Token expired, refresh it
      try {
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        const tokenResponse = await oauth2Client.refreshAccessToken()
        const newTokens = tokenResponse.credentials

        console.log("Token refreshed successfully")

        const response = NextResponse.json({ user: JSON.parse(userInfo) })

        // Update cookies with new tokens
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: "/",
        }

        if (newTokens.access_token) {
          response.cookies.set("access_token", newTokens.access_token, cookieOptions)
        }
        if (newTokens.expiry_date) {
          response.cookies.set("token_expiry", newTokens.expiry_date.toString(), cookieOptions)
        }

        return response
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError)
        return NextResponse.json({ user: null }, { status: 401 })
      }
    }

    // Token is still valid, verify it works
    try {
      oauth2Client.setCredentials({ access_token: accessToken })
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
      await oauth2.userinfo.get()

      return NextResponse.json({ user: JSON.parse(userInfo) })
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError)

      // Try to refresh if we have a refresh token
      if (refreshToken) {
        try {
          oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          const tokenResponse = await oauth2Client.refreshAccessToken()
          const newTokens = tokenResponse.credentials

          const response = NextResponse.json({ user: JSON.parse(userInfo) })

          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: "/",
          }

          if (newTokens.access_token) {
            response.cookies.set("access_token", newTokens.access_token, cookieOptions)
          }
          if (newTokens.expiry_date) {
            response.cookies.set("token_expiry", newTokens.expiry_date.toString(), cookieOptions)
          }

          return response
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError)
          return NextResponse.json({ user: null }, { status: 401 })
        }
      }

      return NextResponse.json({ user: null }, { status: 401 })
    }
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
