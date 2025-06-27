import { type NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { google } from "googleapis";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 30;

// PROPER cache system with better key management
const emailCache = new Map<
  string,
  {
    quickData: any[]; // Instant emails
    fullData: any[]; // Background processed emails
    timestamp: number;
    expiresAt: number;
    isProcessing: boolean;
    lastRefresh: number;
  }
>();

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const INSTANT_EMAILS = 30; // Quick analysis
const BACKGROUND_EMAILS = 150; // Background processing
const MAX_DETAILED_CONTENT = 15; // Full content for top emails

// Background processing queue
const backgroundQueue = new Set<string>();

// Lightning-fast priority scoring
function calculatePriorityScore(factors: {
  isUnread: boolean;
  isImportant: boolean;
  isStarred: boolean;
  hoursSinceReceived: number;
  subject: string;
}): number {
  let score = 0;

  if (factors.isUnread) score += 50;
  if (factors.isImportant) score += 40;
  if (factors.isStarred) score += 30;

  if (factors.hoursSinceReceived < 1) score += 30;
  else if (factors.hoursSinceReceived < 24) score += 10;

  const subjectLower = factors.subject.toLowerCase();
  if (
    subjectLower.includes("urgent") ||
    subjectLower.includes("otp") ||
    subjectLower.includes("code")
  ) {
    score += 25;
  }

  return score;
}

// Fast content extraction
async function fastExtractContent(
  gmail: any,
  messageId: string
): Promise<string> {
  try {
    const message = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    let textContent = "";

    const quickExtractFromParts = (parts: any[]): string => {
      for (const part of parts) {
        if (part.parts) {
          const nestedContent = quickExtractFromParts(part.parts);
          if (nestedContent && nestedContent.length > textContent.length) {
            textContent = nestedContent;
          }
        } else if (part.mimeType === "text/plain" && part.body?.data) {
          try {
            const decoded = Buffer.from(part.body.data, "base64").toString(
              "utf-8"
            );
            if (decoded.trim().length > textContent.length) {
              return decoded.trim();
            }
          } catch (e) {
            // Continue
          }
        } else if (
          part.mimeType === "text/html" &&
          part.body?.data &&
          !textContent
        ) {
          try {
            const decoded = Buffer.from(part.body.data, "base64").toString(
              "utf-8"
            );
            const htmlToText = decoded
              .replace(/<style[^>]*>.*?<\/style>/gis, "")
              .replace(/<script[^>]*>.*?<\/script>/gis, "")
              .replace(/<[^>]*>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, " ")
              .trim();

            if (htmlToText.length > textContent.length) {
              return htmlToText;
            }
          } catch (e) {
            // Continue
          }
        }
      }
      return textContent;
    };

    if (message.data.payload?.parts) {
      textContent = quickExtractFromParts(message.data.payload.parts);
    } else if (message.data.payload?.body?.data) {
      try {
        const decoded = Buffer.from(
          message.data.payload.body.data,
          "base64"
        ).toString("utf-8");
        if (message.data.payload.mimeType === "text/html") {
          textContent = decoded
            .replace(/<style[^>]*>.*?<\/style>/gis, "")
            .replace(/<script[^>]*>.*?<\/script>/gis, "")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, " ")
            .trim();
        } else {
          textContent = decoded;
        }
      } catch (e) {
        textContent = message.data.snippet || "";
      }
    }

    if (textContent) {
      textContent = textContent
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .substring(0, 500);
    }

    return textContent || message.data.snippet || "";
  } catch (error) {
    console.error(`Error extracting content for message ${messageId}:`, error);
    return "";
  }
}

// PROPER cache key generation
function getCacheKey(accessToken: string, userEmail: string): string {
  return `emails_${userEmail}_${accessToken.slice(-8)}`;
}

// INSTANT email analysis with PROPER caching
async function getInstantEmailData(
  accessToken: string,
  refreshToken?: string,
  userEmail = ""
) {
  const cacheKey = getCacheKey(accessToken, userEmail);
  const now = Date.now();

  // Check cache first - PROPERLY
  if (emailCache.has(cacheKey)) {
    const cached = emailCache.get(cacheKey)!;
    if (now < cached.expiresAt && cached.quickData.length > 0) {
      console.log(
        `⚡ CACHE HIT: Using cached data (${
          cached.quickData.length
        } emails, age: ${Math.round((now - cached.timestamp) / 1000)}s)`
      );

      // Start background refresh if cache is getting old (5+ minutes)
      if (now - cached.timestamp > 5 * 60 * 1000 && !cached.isProcessing) {
        console.log(
          `🔄 Starting background refresh for cache key: ${cacheKey}`
        );
        setImmediate(() =>
          backgroundEmailProcessing(
            accessToken,
            refreshToken,
            cacheKey,
            userEmail
          )
        );
      }

      return cached.quickData;
    } else {
      console.log(
        `⚡ CACHE EXPIRED: Removing old cache (age: ${Math.round(
          (now - cached.timestamp) / 1000
        )}s)`
      );
      emailCache.delete(cacheKey);
    }
  }

  try {
    console.log(
      `⚡ CACHE MISS: Starting fresh analysis of ${INSTANT_EMAILS} emails...`
    );
    const startTime = Date.now();

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get threads
    const threadsResponse = await gmail.users.threads.list({
      userId: "me",
      maxResults: INSTANT_EMAILS,
      q: "in:inbox -in:spam -in:trash",
    });

    const emailData = [];

    if (threadsResponse.data.threads) {
      console.log(
        `⚡ Processing ${threadsResponse.data.threads.length} threads...`
      );

      // Process in parallel for speed
      const promises = threadsResponse.data.threads.map(
        async (thread, index) => {
          if (!thread.id) return null;

          try {
            const threadDetail = await gmail.users.threads.get({
              userId: "me",
              id: thread.id,
            });

            const messages = threadDetail.data.messages || [];
            const lastMessage = messages[messages.length - 1];

            if (lastMessage) {
              const headers = lastMessage.payload?.headers || [];
              const subject =
                headers.find((h) => h.name === "Subject")?.value ||
                "No Subject";
              const from =
                headers.find((h) => h.name === "From")?.value || "Unknown";
              const date = headers.find((h) => h.name === "Date")?.value || "";

              const isUnread =
                lastMessage.labelIds?.includes("UNREAD") || false;
              const isImportant =
                lastMessage.labelIds?.includes("IMPORTANT") || false;
              const isStarred =
                lastMessage.labelIds?.includes("STARRED") || false;

              const senderMatch =
                from.match(/^(.*?)\s*<(.+)>$/) || from.match(/^(.+)$/);
              const senderName = senderMatch
                ? (senderMatch[1] || senderMatch[0]).replace(/"/g, "").trim()
                : "Unknown";

              let parsedDate = new Date();
              try {
                parsedDate = new Date(date);
              } catch (e) {
                parsedDate = new Date();
              }

              const hoursSinceReceived = Math.floor(
                (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60)
              );

              // Get content for priority emails
              let content = "";
              if (lastMessage.id && index < MAX_DETAILED_CONTENT) {
                content = await fastExtractContent(gmail, lastMessage.id);
              } else {
                content = threadDetail.data.snippet || "";
              }

              const priorityScore = calculatePriorityScore({
                isUnread,
                isImportant,
                isStarred,
                hoursSinceReceived,
                subject,
              });

              return {
                id: thread.id,
                subject,
                from,
                senderName,
                date,
                parsedDate,
                hoursSinceReceived,
                content: content || "No content available",
                snippet: threadDetail.data.snippet || "",
                isUnread,
                isImportant,
                isStarred,
                priorityScore,
                messageCount: messages.length,
                timestamp: parsedDate.getTime(),
                hasFullContent: index < MAX_DETAILED_CONTENT && !!content,
              };
            }
          } catch (error) {
            console.error(`Error processing thread ${thread.id}:`, error);
            return null;
          }
        }
      );

      const results = await Promise.all(promises);
      emailData.push(...results.filter(Boolean));
    }

    // Sort by priority
    emailData.sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.timestamp - a.timestamp;
    });

    // PROPERLY cache the results
    const cacheData = {
      quickData: emailData,
      fullData: [], // Will be populated by background
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
      isProcessing: false,
      lastRefresh: now,
    };

    emailCache.set(cacheKey, cacheData);

    const processingTime = Date.now() - startTime;
    console.log(
      `⚡ FRESH ANALYSIS complete: ${
        emailData.length
      } emails in ${processingTime}ms - CACHED for ${
        CACHE_DURATION / 1000 / 60
      } minutes`
    );

    // Start background processing for more emails
    if (emailData.length > 0) {
      console.log(
        `🔄 Queuing background processing for ${BACKGROUND_EMAILS} emails...`
      );
      setImmediate(() =>
        backgroundEmailProcessing(
          accessToken,
          refreshToken,
          cacheKey,
          userEmail
        )
      );
    }

    return emailData;
  } catch (error) {
    console.error("Error in instant email analysis:", error);
    return [];
  }
}

// ACTUAL background processing implementation
async function backgroundEmailProcessing(
  accessToken: string,
  refreshToken?: string,
  cacheKey: string,
  userEmail = ""
) {
  // Prevent duplicate background processing
  if (backgroundQueue.has(cacheKey)) {
    console.log(`🔄 Background processing already running for ${cacheKey}`);
    return;
  }

  backgroundQueue.add(cacheKey);

  try {
    console.log(
      `🔄 BACKGROUND: Starting processing of ${BACKGROUND_EMAILS} emails...`
    );
    const startTime = Date.now();

    // Mark as processing
    const cached = emailCache.get(cacheKey);
    if (cached) {
      cached.isProcessing = true;
      emailCache.set(cacheKey, cached);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get more threads in background
    const threadsResponse = await gmail.users.threads.list({
      userId: "me",
      maxResults: BACKGROUND_EMAILS,
      q: "in:inbox -in:spam -in:trash",
    });

    const backgroundEmails = [];

    if (threadsResponse.data.threads) {
      console.log(
        `🔄 BACKGROUND: Processing ${threadsResponse.data.threads.length} threads...`
      );

      // Process in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < threadsResponse.data.threads.length; i += batchSize) {
        const batch = threadsResponse.data.threads.slice(i, i + batchSize);

        const batchPromises = batch.map(async (thread, batchIndex) => {
          if (!thread.id) return null;

          try {
            const threadDetail = await gmail.users.threads.get({
              userId: "me",
              id: thread.id,
            });

            const messages = threadDetail.data.messages || [];
            const lastMessage = messages[messages.length - 1];

            if (lastMessage) {
              const headers = lastMessage.payload?.headers || [];
              const subject =
                headers.find((h) => h.name === "Subject")?.value ||
                "No Subject";
              const from =
                headers.find((h) => h.name === "From")?.value || "Unknown";
              const date = headers.find((h) => h.name === "Date")?.value || "";

              const isUnread =
                lastMessage.labelIds?.includes("UNREAD") || false;
              const isImportant =
                lastMessage.labelIds?.includes("IMPORTANT") || false;
              const isStarred =
                lastMessage.labelIds?.includes("STARRED") || false;

              const senderMatch =
                from.match(/^(.*?)\s*<(.+)>$/) || from.match(/^(.+)$/);
              const senderName = senderMatch
                ? (senderMatch[1] || senderMatch[0]).replace(/"/g, "").trim()
                : "Unknown";

              let parsedDate = new Date();
              try {
                parsedDate = new Date(date);
              } catch (e) {
                parsedDate = new Date();
              }

              const hoursSinceReceived = Math.floor(
                (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60)
              );

              // Use snippet for background processing (faster)
              const content = threadDetail.data.snippet || "";

              const priorityScore = calculatePriorityScore({
                isUnread,
                isImportant,
                isStarred,
                hoursSinceReceived,
                subject,
              });

              return {
                id: thread.id,
                subject,
                from,
                senderName,
                date,
                parsedDate,
                hoursSinceReceived,
                content,
                snippet: content,
                isUnread,
                isImportant,
                isStarred,
                priorityScore,
                messageCount: messages.length,
                timestamp: parsedDate.getTime(),
                hasFullContent: false,
                isBackgroundProcessed: true,
              };
            }
          } catch (error) {
            console.error(
              `Background error processing thread ${thread.id}:`,
              error
            );
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        backgroundEmails.push(...batchResults.filter(Boolean));

        // Small delay between batches
        if (i + batchSize < threadsResponse.data.threads.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    // Update cache with background data
    const existingCache = emailCache.get(cacheKey);
    if (existingCache) {
      // Merge and deduplicate
      const allEmails = [...existingCache.quickData];

      // Add background emails that aren't already in quick data
      for (const bgEmail of backgroundEmails) {
        if (!allEmails.find((email) => email.id === bgEmail.id)) {
          allEmails.push(bgEmail);
        }
      }

      // Sort all emails
      allEmails.sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return b.timestamp - a.timestamp;
      });

      existingCache.fullData = allEmails;
      existingCache.isProcessing = false;
      existingCache.lastRefresh = Date.now();
      emailCache.set(cacheKey, existingCache);

      const processingTime = Date.now() - startTime;
      console.log(
        `🔄 BACKGROUND COMPLETE: ${backgroundEmails.length} additional emails processed in ${processingTime}ms. Total: ${allEmails.length} emails cached.`
      );
    }
  } catch (error) {
    console.error("Background processing error:", error);

    // Mark as not processing on error
    const cached = emailCache.get(cacheKey);
    if (cached) {
      cached.isProcessing = false;
      emailCache.set(cacheKey, cached);
    }
  } finally {
    backgroundQueue.delete(cacheKey);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const userInfo = request.cookies.get("user_info")?.value;
    const accessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;

    let userName = "there";
    let userEmail = "";
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        userName = user.name?.split(" ")[0] || "there";
        userEmail = user.email || "";
      } catch (e) {
        // Fallback to default
      }
    }

    // Get INSTANT email analysis with PROPER caching
    let emailContext = "";
    let emailCount = 0;
    let cacheStatus = "No cache";

    if (accessToken) {
      const instantEmails = await getInstantEmailData(
        accessToken,
        refreshToken,
        userEmail
      );
      emailCount = instantEmails.length;

      // Check if we have background data available
      const cacheKey = getCacheKey(accessToken, userEmail);
      const cached = emailCache.get(cacheKey);
      const totalEmails = cached?.fullData?.length || emailCount;
      cacheStatus = cached
        ? `Cached (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`
        : "Fresh";

      if (instantEmails.length > 0) {
        const unreadEmails = instantEmails.filter((email) => email.isUnread);
        const importantEmails = instantEmails.filter(
          (email) => email.isImportant || email.isStarred
        );
        const recentEmails = instantEmails.filter(
          (email) => email.hoursSinceReceived < 24
        );
        const withFullContent = instantEmails.filter(
          (email) => email.hasFullContent
        );

        emailContext = `\n\n⚡ SMART EMAIL ANALYSIS (${emailCount} instant + ${
          totalEmails - emailCount
        } background = ${totalEmails} total):

📊 OVERVIEW:
- Cache Status: ${cacheStatus}
- Instant Analysis: ${emailCount} emails
- Background Processed: ${totalEmails - emailCount} emails  
- Unread: ${unreadEmails.length}
- Important/Starred: ${importantEmails.length}
- Last 24 Hours: ${recentEmails.length}
- Full Content: ${withFullContent.length}

🔥 TOP PRIORITY EMAILS:
${instantEmails
  .slice(0, 10)
  .map(
    (email, index) => `
${index + 1}. ${email.isUnread ? "🔴 UNREAD" : "✅ READ"} - Priority: ${
      email.priorityScore
    }
   📧 "${email.subject}"
   👤 From: ${email.senderName}
   📅 ${email.parsedDate.toLocaleDateString()} (${
      email.hoursSinceReceived
    }h ago)
   📝 ${email.content.substring(0, 200)}${
      email.content.length > 200 ? "..." : ""
    }
   ${email.isImportant ? "⭐ IMPORTANT" : ""} ${
      email.isStarred ? "⭐ STARRED" : ""
    }
   ${email.hasFullContent ? "🔍 FULL CONTENT" : "📄 SNIPPET"}
`
  )
  .join("")}

⚡ Smart caching active - subsequent requests will be instant! Background processing provides access to ${totalEmails} total emails.`;

        console.log(
          `⚡ Response ready: ${emailCount} instant emails (${cacheStatus}), ${totalEmails} total available`
        );
      } else {
        emailContext =
          "\n\n⚡ Unable to access email data. Please ensure you're signed in with Google.";
      }
    } else {
      emailContext =
        "\n\n⚡ No Gmail access. Sign in with Google for smart email analysis.";
    }

    const systemPrompt = `You are Inbox Buddy, a SMART-CACHED AI email assistant helping ${userName} (${userEmail}).

SMART CACHING MODE:
- Gmail Connection: ${
      accessToken ? "✅ Connected - Smart Caching Active" : "❌ Not Connected"
    }
- Emails Available: ${emailCount} instant analysis + background processing
- Cache Status: ${cacheStatus}
- Performance: Instant responses after first load

EMAIL DATA:${emailContext}

⚡ SMART CACHING GUIDELINES:
🚀 LEVERAGE CACHED DATA:
- First request: Fresh analysis (may take 10-20 seconds)
- Subsequent requests: Instant responses from cache
- Background processing: Continuous updates of more emails
- Smart refresh: Auto-refresh when cache gets old

💬 BE PERFORMANCE-AWARE:
- Mention cache status when relevant
- Explain that first load takes time but subsequent requests are instant
- Reference both instant and background processed emails
- Highlight the smart caching benefits

🎯 USE ALL AVAILABLE DATA:
- Prioritize instant analysis emails for detailed responses
- Reference background processed emails when relevant
- Extract specific information from email content
- Provide actionable insights from cached data

Remember: You have smart caching - first load builds the cache, then everything is instant!`;

    let result;

    try {
      result = streamText({
        model: groq("llama-3.1-8b-instant"),
        messages,
        system: systemPrompt,
        temperature: 0.2,
        maxTokens: 2000,
      });
    } catch (primaryError) {
      console.warn("Primary model failed, falling back:", primaryError);

      result = streamText({
        model: groq("llama-3.3-70b-versatile"),
        messages,
        system: systemPrompt,
        temperature: 0.3,
        maxTokens: 2000,
      });
    }

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}
// v12
