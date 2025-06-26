import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

export async function POST(request: NextRequest) {
  try {
    const { threadId, replyContent, subject } = await request.json()
    const accessToken = request.cookies.get("access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )
    oauth2Client.setCredentials({ access_token: accessToken })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Get the original thread to extract recipient info
    const threadDetail = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    })

    const messages = threadDetail.data.messages || []
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const originalSender = lastMessage.payload?.headers?.find((h) => h.name === "From")?.value || ""
    const messageId = lastMessage.payload?.headers?.find((h) => h.name === "Message-ID")?.value || ""

    // Create email message
    const emailLines = [
      `To: ${originalSender}`,
      `Subject: ${subject}`,
      `In-Reply-To: ${messageId}`,
      `References: ${messageId}`,
      "",
      replyContent,
    ]

    const email = emailLines.join("\n")
    const encodedEmail = Buffer.from(email).toString("base64").replace(/\+/g, "-").replace(/\//g, "_")

    // Send the reply
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
        threadId: threadId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending reply:", error)
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 })
  }
}
