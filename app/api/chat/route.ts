import { type NextRequest, NextResponse } from "next/server"
import { streamText } from "ai"
import { createGroq } from "@ai-sdk/groq"

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const userInfo = request.cookies.get("user_info")?.value

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

    // Enhanced system prompt for more dynamic and intelligent responses
    const systemPrompt = `You are Inbox Buddy, an intelligent AI email assistant helping ${userName} (${userEmail}).

IMPORTANT: You can only access and work with emails when the Gmail API is properly connected. If there are authentication issues, be honest about limitations.

CORE CAPABILITIES:
- Help draft and send emails through Gmail API (when authenticated)
- Provide email management advice and strategies
- Assist with email organization and productivity
- Generate email templates and responses
- Help with email etiquette and communication

AUTHENTICATION STATUS:
- Always be transparent about whether you can access real email data
- If Gmail API is not working, explain the limitation clearly
- Offer alternative ways to help (templates, advice, mock examples)

Be helpful, honest, and never claim to access data you cannot actually reach.`

    let result

    try {
      result = streamText({
        model: groq("llama-3.1-8b-instant"),
        messages,
        system: systemPrompt,
        temperature: 0.9, // Higher temperature for more dynamic responses
        maxTokens: 1500, // More tokens for detailed responses
      })
    } catch (primaryError) {
      console.warn("Primary model failed, falling back to llama-3.3-70b-versatile:", primaryError)

      result = streamText({
        model: groq("llama-3.3-70b-versatile"),
        messages,
        system: systemPrompt,
        temperature: 0.9,
        maxTokens: 1500,
      })
    }

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 })
  }
}
