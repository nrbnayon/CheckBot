import { type NextRequest, NextResponse } from "next/server"
import { Groq } from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { emailContent, context } = await request.json()

    const prompt = `You are an intelligent email assistant. Generate a professional and contextually appropriate reply to the following email.

Email to reply to:
${emailContent}

Context: ${context || "No additional context provided"}

Please generate a professional, friendly, and helpful reply. Keep it concise but comprehensive. Match the tone of the original email. Do not include subject line or email headers, just the body content.`

    let completion

    try {
      // Try primary model first
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a professional email assistant that helps users craft appropriate email replies. Always be polite, professional, and helpful. Generate only the email body content without headers or subject lines.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 1000,
      })
    } catch (primaryError) {
      console.warn("Primary model failed, using fallback:", primaryError)

      // Fallback to secondary model
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a professional email assistant that helps users craft appropriate email replies. Always be polite, professional, and helpful. Generate only the email body content without headers or subject lines.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 1000,
      })
    }

    const reply = completion.choices[0]?.message?.content || "Unable to generate reply"

    return NextResponse.json({ reply })
  } catch (error) {
    console.error("Error generating reply:", error)
    return NextResponse.json({ error: "Failed to generate reply" }, { status: 500 })
  }
}
