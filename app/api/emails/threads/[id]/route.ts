import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    const threadDetail = await gmail.users.threads.get({
      userId: "me",
      id: params.id,
    })

    const messages = threadDetail.data.messages || []
    const lastMessage = messages[messages.length - 1]
    const firstMessage = messages[0]

    if (!lastMessage || !firstMessage) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const subject = firstMessage.payload?.headers?.find((h) => h.name === "Subject")?.value || "No Subject"
    const sender = lastMessage.payload?.headers?.find((h) => h.name === "From")?.value || "Unknown"
    const timestamp = new Date(Number.parseInt(lastMessage.internalDate || "0")).toISOString()

    // Extract email body
    let body = ""
    if (lastMessage.payload?.parts) {
      for (const part of lastMessage.payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8")
          break
        }
      }
    } else if (lastMessage.payload?.body?.data) {
      body = Buffer.from(lastMessage.payload.body.data, "base64").toString("utf-8")
    }

    if (!body) {
      body = threadDetail.data.snippet || ""
    }

    return NextResponse.json({
      id: params.id,
      subject,
      sender,
      timestamp,
      body,
      snippet: threadDetail.data.snippet,
      messages: messages.length,
    })
  } catch (error) {
    console.error("Error fetching thread details:", error)
    return NextResponse.json({ error: "Failed to fetch thread details" }, { status: 500 })
  }
}
