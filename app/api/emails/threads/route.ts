import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Groq } from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value
    const refreshToken = request.cookies.get("refresh_token")?.value

    if (!accessToken) {
      console.log("No access token found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Attempting to fetch emails with token:", accessToken.substring(0, 20) + "...")

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Test the connection first
    try {
      const profile = await gmail.users.getProfile({ userId: "me" })
      console.log("Gmail connection successful for:", profile.data.emailAddress)
    } catch (profileError) {
      console.error("Gmail profile test failed:", profileError)
      return NextResponse.json({ error: "Gmail access failed" }, { status: 401 })
    }

    // Get threads from inbox
    const threadsResponse = await gmail.users.threads.list({
      userId: "me",
      maxResults: 10,
      q: "in:inbox",
    })

    console.log(`Found ${threadsResponse.data.threads?.length || 0} threads`)

    const threads = []
    const stats = { needResponse: 0, responded: 0, totalUnread: 0 }

    if (threadsResponse.data.threads) {
      for (const thread of threadsResponse.data.threads.slice(0, 10)) {
        if (!thread.id) continue

        try {
          const threadDetail = await gmail.users.threads.get({
            userId: "me",
            id: thread.id,
          })

          const messages = threadDetail.data.messages || []
          const lastMessage = messages[messages.length - 1]
          const firstMessage = messages[0]

          if (lastMessage && firstMessage) {
            const subject = firstMessage.payload?.headers?.find((h) => h.name === "Subject")?.value || "No Subject"
            const from = lastMessage.payload?.headers?.find((h) => h.name === "From")?.value || "Unknown"
            const snippet = threadDetail.data.snippet || ""

            // AI-powered importance detection
            const importance = await determineImportanceWithAI(subject, from, snippet)

            // Determine status based on thread analysis
            const status = determineStatus(messages)

            const unreadCount = messages.filter((msg) => msg.labelIds?.includes("UNREAD")).length

            threads.push({
              id: thread.id,
              subject,
              sender: from,
              snippet,
              timestamp: new Date(Number.parseInt(lastMessage.internalDate || "0")).toISOString(),
              status,
              importance,
              unreadCount,
            })

            // Update stats
            if (status === "need_response") stats.needResponse++
            if (status === "responded") stats.responded++
            stats.totalUnread += unreadCount
          }
        } catch (threadError) {
          console.error(`Error processing thread ${thread.id}:`, threadError)
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

    const response = NextResponse.json({ threads, stats })

    return response
  } catch (error) {
    console.error("Error fetching threads:", error)
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 })
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
- Urgency indicators (urgent, asap, deadline, time-sensitive)
- Business importance (meeting, interview, contract, proposal)
- Sender authority (CEO, manager, client, customer)
- Action required (response needed, decision required)
- Personal vs automated (newsletters, notifications vs personal emails)

Respond with only one word: high, medium, or low`

    let completion
    try {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are an expert email assistant that analyzes email importance. Respond with only 'high', 'medium', or 'low'.",
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
            content:
              "You are an expert email assistant that analyzes email importance. Respond with only 'high', 'medium', or 'low'.",
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
    "urgent",
    "asap",
    "important",
    "deadline",
    "meeting",
    "interview",
    "contract",
    "proposal",
  ]
  const text = `${subject} ${from} ${snippet}`.toLowerCase()

  if (highPriorityKeywords.some((keyword) => text.includes(keyword))) {
    return "high"
  }

  if (from.includes("noreply") || from.includes("no-reply") || from.includes("notification")) {
    return "low"
  }

  return "medium"
}

function determineStatus(messages: any[]): "need_response" | "responded" | "read" {
  if (messages.length === 1) {
    return "need_response"
  }

  const lastMessage = messages[messages.length - 1]
  const isFromMe = lastMessage.payload?.headers?.find((h: any) => h.name === "From")?.value?.includes("me")

  if (isFromMe) {
    return "responded"
  }

  return "need_response"
}
