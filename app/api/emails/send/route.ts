import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

async function refreshTokenIfNeeded(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  try {
    // Test the token
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
    await oauth2.userinfo.get()
    return { oauth2Client, newTokens: null }
  } catch (error) {
    // Token invalid, try to refresh
    if (refreshToken) {
      try {
        const tokenResponse = await oauth2Client.refreshAccessToken()
        oauth2Client.setCredentials(tokenResponse.credentials)
        return { oauth2Client, newTokens: tokenResponse.credentials }
      } catch (refreshError) {
        throw new Error("Token refresh failed")
      }
    }
    throw new Error("Invalid token and no refresh token")
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value
    const refreshToken = request.cookies.get("refresh_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const to = formData.get("to") as string
    const subject = formData.get("subject") as string
    const body = formData.get("body") as string

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("Attempting to send email:", { to, subject })

    const { oauth2Client, newTokens } = await refreshTokenIfNeeded(accessToken, refreshToken)
    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Get user's email address
    const profile = await gmail.users.getProfile({ userId: "me" })
    const fromEmail = profile.data.emailAddress

    console.log("Sending from:", fromEmail)

    // Handle attachments
    const attachments: any[] = []
    const attachmentKeys = Array.from(formData.keys()).filter((key) => key.startsWith("attachment_"))

    for (const key of attachmentKeys) {
      const file = formData.get(key) as File
      if (file) {
        const buffer = await file.arrayBuffer()
        const base64Data = Buffer.from(buffer).toString("base64")
        attachments.push({
          filename: file.name,
          content: base64Data,
          contentType: file.type,
        })
      }
    }

    // Create email message with proper formatting
    const emailLines = [`From: ${fromEmail}`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0"]

    if (attachments.length > 0) {
      const boundary = "boundary_" + Math.random().toString(36).substr(2, 9)
      emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
      emailLines.push("")
      emailLines.push(`--${boundary}`)
      emailLines.push("Content-Type: text/plain; charset=UTF-8")
      emailLines.push("Content-Transfer-Encoding: 7bit")
      emailLines.push("")
      emailLines.push(body)

      for (const attachment of attachments) {
        emailLines.push(`--${boundary}`)
        emailLines.push(`Content-Type: ${attachment.contentType}; name="${attachment.filename}"`)
        emailLines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
        emailLines.push("Content-Transfer-Encoding: base64")
        emailLines.push("")
        emailLines.push(attachment.content)
      }

      emailLines.push(`--${boundary}--`)
    } else {
      emailLines.push("Content-Type: text/plain; charset=UTF-8")
      emailLines.push("Content-Transfer-Encoding: 7bit")
      emailLines.push("")
      emailLines.push(body)
    }

    const email = emailLines.join("\r\n")
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    // Send the email
    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    })

    console.log("Email sent successfully:", result.data.id)

    const response = NextResponse.json({
      success: true,
      messageId: result.data.id,
      to,
      subject,
      attachmentCount: attachments.length,
    })

    // Update cookies if tokens were refreshed
    if (newTokens) {
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
    }

    return response
  } catch (error: any) {
    console.error("Error sending email:", error)

    if (error.code === 401 || error.message?.includes("invalid_grant")) {
      return NextResponse.json({ error: "Authentication expired" }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
