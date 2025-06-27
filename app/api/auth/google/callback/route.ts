import { type NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Enhanced scopes for full Gmail access
const getScopes = () => {
  return [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.labels",
  ];
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // If no code, initiate OAuth flow
  if (!code && !error) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: getScopes(),
      prompt: "consent",
      include_granted_scopes: true,
    });
    return NextResponse.redirect(authUrl);
  }

  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(new URL("/?error=oauth_error", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    // Fix: Use getToken instead of getAccessToken
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Verify the token works by getting user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    console.log("OAuth Success - User:", userInfo.email);
    console.log("Scopes granted:", tokens.scope);
    console.log("Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    const response = NextResponse.redirect(new URL("/dashboard", request.url));

    // Set secure HTTP-only cookies for 30 days
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    };

    if (tokens.access_token) {
      response.cookies.set("access_token", tokens.access_token, cookieOptions);
    }
    if (tokens.refresh_token) {
      response.cookies.set(
        "refresh_token",
        tokens.refresh_token,
        cookieOptions
      );
    }
    if (tokens.expiry_date) {
      response.cookies.set(
        "token_expiry",
        tokens.expiry_date.toString(),
        cookieOptions
      );
    }
    response.cookies.set("user_info", JSON.stringify(userInfo), cookieOptions);

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
