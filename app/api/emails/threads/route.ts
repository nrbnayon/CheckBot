import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Groq } from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

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
        console.log("Refreshing expired token...")
        const tokenResponse = await oauth2Client.refreshAccessToken()
        oauth2Client.setCredentials(tokenResponse.credentials)
        return { oauth2Client, newTokens: tokenResponse.credentials }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError)
        throw new Error("Token refresh failed")
      }
    }
    throw new Error("Invalid token and no refresh token")
  }
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value
    const refreshToken = request.cookies.get("refresh_token")?.value

    if (!accessToken) {
      console.log("No access token found in cookies")
      return NextResponse.json({ 
        error: "No authentication found. Please sign in with Google.",
        needsAuth: true 
      }, { status: 401 })
    }

    console.log("Attempting to fetch emails with token:", accessToken.substring(0, 20) + "...")

    // Refresh token if needed
    const { oauth2Client, newTokens } = await refreshTokenIfNeeded(accessToken, refreshToken)
    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Test Gmail connection
    try {
      const profile = await gmail.users.getProfile({ userId: "me" })
      console.log("✅ Gmail connection successful for:", profile.data.emailAddress)
      console.log("📧 Total messages in account:", profile.data.messagesTotal)
    } catch (profileError) {
      console.error("❌ Gmail profile test failed:", profileError)
      return NextResponse.json({ 
        error: "Failed to connect to Gmail. Please check your permissions.",
        details: profileError.message 
      }, { status: 403 })
    }

    // Get recent threads from inbox
    console.log("📥 Fetching recent email threads...")
    const threadsResponse = await gmail.users.threads.list({
      userId: "me",
      maxResults: 15,
      q: "in:inbox -in:spam -in:trash",
    })

    console.log(`📊 Found ${threadsResponse.data.threads?.length || 0} threads`)

    const threads = []
    const stats = { needResponse: 0, responded: 0, totalUnread: 0 }

    if (threadsResponse.data.threads) {
      for (const thread of threadsResponse.data.threads.slice(0, 10)) {
        if (!thread.id) continue

        try {
          console.log(`📧 Processing thread: ${thread.id}`)
          const threadDetail = await gmail.users.threads.get({
            userId: "me",
            id: thread.id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date", "To"]
          })

          const messages = threadDetail.data.messages || []
          const lastMessage = messages[messages.length - 1]
          const firstMessage = messages[0]

          if (lastMessage && firstMessage) {
            const headers = lastMessage.payload?.headers || []
            const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject"
            const from = headers.find((h) => h.name === "From")?.value || "Unknown"
            const to = headers.find((h) => h.name === "To")?.value || ""
            const snippet = threadDetail.data.snippet || ""

            // Check if it's from the user (sent by them)
            const userEmail = (await gmail.users.getProfile({ userId: "me" })).data.emailAddress
            const isFromUser = from.includes(userEmail || "")

            // AI-powered importance detection
            const importance = await determineImportanceWithAI(subject, from, snippet)

            // Determine status based on thread analysis
            const status = determineStatus(messages, userEmail || "")

            const unreadCount = messages.filter((msg) => 
              msg.labelIds?.includes("UNREAD")
            ).length

            threads.push({
              id: thread.id,
              subject,
              sender: from,
              recipient: to,
              snippet,
              timestamp: new Date(Number.parseInt(lastMessage.internalDate || "0")).toISOString(),
              status,
              importance,
              unreadCount,
              messageCount: messages.length,
              isFromUser
            })

            // Update stats
            if (status === "need_response") stats.needResponse++
            if (status === "responded") stats.responded++
            stats.totalUnread += unreadCount

            console.log(`✅ Processed: ${subject.substring(0, 50)}... (${importance} priority)`)
          }
        } catch (threadError) {
          console.error(`❌ Error processing thread ${thread.id}:`, threadError)
          continue
        }
      }
    }

    // Sort by importance and timestamp
    threads.sort((a, b) => {
      const importanceOrder = { high: 3, medium: 2, low: 1 }
      if (importanceOrder[a.importance] !== importanceOrder[b.importance]) {
        return importanceOrder[b.importance] - importanceOrder[a.importance]
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    console.log(`🎯 Successfully processed ${threads.length} email threads`)
    console.log(`📊 Stats: ${stats.needResponse} need response, ${stats.responded} responded, ${stats.totalUnread} unread`)

    const response = NextResponse.json({ 
      threads, 
      stats,
      success: true,
      message: `Successfully loaded ${threads.length} real email threads from your Gmail account`
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
    console.error("❌ Critical error fetching threads:", error)
    
    if (error.message?.includes("invalid_grant") || error.code === 401) {
      return NextResponse.json({ 
        error: "Authentication expired. Please sign in again.",
        needsAuth: true 
      }, { status: 401 })
    }

    return NextResponse.json({ 
      error: "Failed to fetch email threads", 
      details: error.message,
      needsAuth: false
    }, { status: 500 })
  }
}

// AI-powered importance detection
async function determineImportanceWithAI(
  subject: string,
  from: string,
  snippet: string,
): Promise<"high" | "medium" | "low"> {
  try {
    const prompt = `Analyze this email and determine its importance level (high, medium, or low) based on:

Subject: ${subject}
From: ${from}
Content: ${snippet}

Consider these factors:
- Urgency indicators (urgent, asap, deadline, time-sensitive, important)
- Business importance (meeting, interview, contract, proposal, invoice)
- Sender authority (CEO, manager, client, customer, boss)
- Action required (response needed, decision required, approval needed)
- Personal vs automated (newsletters, notifications vs personal emails)
- Financial matters (payment, billing, money)

Respond with only one word: high, medium, or low`

    let completion
    try {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert email assistant that analyzes email importance. Respond with only 'high', 'medium', or 'low'.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        max_tokens: 10,
      })
    } catch (primaryError) {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert email assistant that analyzes email importance. Respond with only 'high', 'medium', or 'low'.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 10,
      })
    }

    const importance = completion.choices[0]?.message?.content?.toLowerCase().trim()

    if (importance === "high" || importance === "medium" || importance === "low") {
      return importance as "high" | "medium" | "low"
    }

    // Fallback to basic detection
    return determineImportanceBasic(subject, from, snippet)
  } catch (error) {
    console.error("AI importance detection failed, using fallback:", error)
    return determineImportanceBasic(subject, from, snippet)
  }
}

// Fallback basic importance detection
function determineImportanceBasic(subject: string, from: string, snippet: string): "high" | "medium" | "low" {
  const highPriorityKeywords = [
    "urgent", "asap", "important", "deadline", "meeting", "interview", 
    "contract", "proposal", "invoice", "payment", "bill", "overdue",
    "action required", "response needed", "time sensitive"
  ]
  
  const text = `${subject} ${from} ${snippet}`.toLowerCase()

  if (highPriorityKeywords.some((keyword) => text.includes(keyword))) {
    return "high"
  }

  if (from.includes("noreply") || from.includes("no-reply") || from.includes("notification") || 
      from.includes("newsletter") || from.includes("automated")) {
    return "low"
  }

  return "medium"
}

function determineStatus(messages: any[], userEmail: string): "need_response" | "responded" | "read" {
  if (messages.length === 1) {
    return "need_response"
  }

  const lastMessage = messages[messages.length - 1]
  const fromHeader = lastMessage.payload?.headers?.find((h: any) => h.name === "From")?.value || ""
  
  const isFromMe = fromHeader.includes(userEmail)

  if (isFromMe) {
    return "responded"
  }

  return "need_response"
}