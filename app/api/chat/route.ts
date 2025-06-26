import { type NextRequest, NextResponse } from "next/server"
import { streamText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { google } from "googleapis"

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30

async function getRecentEmails(accessToken: string, refreshToken?: string) {
  try {
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

    // Get recent threads
    const threadsResponse = await gmail.users.threads.list({
      userId: "me",
      maxResults: 10,
      q: "in:inbox -in:spam -in:trash",
    })

    const emailData = []

    if (threadsResponse.data.threads) {
      for (const thread of threadsResponse.data.threads.slice(0, 5)) {
        if (!thread.id) continue

        try {
          const threadDetail = await gmail.users.threads.get({
            userId: "me",
            id: thread.id,
          })

          const messages = threadDetail.data.messages || []
          const lastMessage = messages[messages.length - 1]

          if (lastMessage) {
            const headers = lastMessage.payload?.headers || []
            const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject"
            const from = headers.find((h) => h.name === "From")?.value || "Unknown"
            const date = headers.find((h) => h.name === "Date")?.value || ""

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

            // Clean up body text (remove excessive whitespace, HTML tags, etc.)
            body = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

            const unreadCount = messages.filter((msg) => 
              msg.labelIds?.includes("UNREAD")
            ).length

            emailData.push({
              id: thread.id,
              subject,
              from,
              date,
              body: body.substring(0, 500), // Limit body length for context
              snippet: threadDetail.data.snippet,
              unreadCount,
              messageCount: messages.length,
            })
          }
        } catch (error) {
          console.error(`Error processing thread ${thread.id}:`, error)
          continue
        }
      }
    }

    return emailData
  } catch (error) {
    console.error("Error fetching emails for chat:", error)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const userInfo = request.cookies.get("user_info")?.value
    const accessToken = request.cookies.get("access_token")?.value
    const refreshToken = request.cookies.get("refresh_token")?.value

    let userName = "there"
    let userEmail = ""
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo)
        userName = user.name?.split(" ")[0] || "there"
        userEmail = user.email || ""
      } catch (e) {
        // Fallback to default
      }
    }

    // Get real email data for context
    let emailContext = ""
    let emailCount = 0
    
    if (accessToken) {
      console.log("🔄 Fetching real email data for AI chat context...")
      const recentEmails = await getRecentEmails(accessToken, refreshToken)
      emailCount = recentEmails.length
      
      if (recentEmails.length > 0) {
        emailContext = `\n\nREAL EMAIL DATA FROM USER'S GMAIL ACCOUNT:
${recentEmails.map((email, index) => `
Email ${index + 1}:
- Subject: ${email.subject}
- From: ${email.from}
- Date: ${email.date}
- Content: ${email.body}
- Unread: ${email.unreadCount > 0 ? 'Yes' : 'No'}
- Messages in thread: ${email.messageCount}
`).join('\n')}

This is REAL data from the user's Gmail account. You can reference specific emails, help with responses, analyze patterns, and provide actionable insights.`

        console.log(`✅ Successfully loaded ${emailCount} real emails for AI context`)
      } else {
        emailContext = "\n\nNote: Unable to access email data at this time. Please ensure you're signed in with Google."
      }
    } else {
      emailContext = "\n\nNote: No Gmail access token found. Please sign in with Google to access your real email data."
    }

    // Enhanced system prompt with real email context
    const systemPrompt = `You are Inbox Buddy, an intelligent AI email assistant helping ${userName} (${userEmail}).

IMPORTANT: You now have access to the user's REAL EMAIL DATA from their Gmail account.

CURRENT EMAIL ACCESS STATUS:
- Gmail Connection: ${accessToken ? '✅ Connected' : '❌ Not Connected'}
- Real Emails Loaded: ${emailCount} recent emails
- User Email: ${userEmail}

CORE CAPABILITIES WITH REAL DATA:
- Analyze actual emails from the user's Gmail inbox
- Help draft replies to specific real emails
- Provide insights about email patterns and senders
- Suggest email organization strategies based on actual data
- Help prioritize emails based on real content and senders
- Generate contextual responses to actual emails
- Identify important emails that need attention

REAL EMAIL CONTEXT:${emailContext}

INSTRUCTIONS:
- When the user asks about their emails, reference the REAL data above
- Be specific about actual email subjects, senders, and content
- Provide actionable advice based on their real email situation
- If asked about specific emails, reference them by subject or sender
- Help with real email management tasks
- Be honest about what you can and cannot access

Be helpful, specific, and use the real email data to provide personalized assistance!`

    let result

    try {
      result = streamText({
        model: groq("llama-3.1-8b-instant"),
        messages,
        system: systemPrompt,
        temperature: 0.7,
        maxTokens: 2000,
      })
    } catch (primaryError) {
      console.warn("Primary model failed, falling back to llama-3.3-70b-versatile:", primaryError)

      result = streamText({
        model: groq("llama-3.3-70b-versatile"),
        messages,
        system: systemPrompt,
        temperature: 0.7,
        maxTokens: 2000,
      })
    }

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 })
  }
}