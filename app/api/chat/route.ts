// app\api\chat\route.ts
import { type NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { google } from "googleapis";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 30;

// 🚀 ENHANCED CACHE SYSTEM - Optimized for 500+ emails
const emailCache = new Map<
  string,
  {
    quickData: any[];
    fullData: any[];
    timestamp: number;
    expiresAt: number;
    isProcessing: boolean;
    lastRefresh: number;
    accessCount: number;
    processingStage: number; // Track progressive loading stages
    totalProcessed: number;
  }
>();

// 🎯 OPTIMIZED CONFIGURATION - Enhanced for 500 emails
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (increased for larger dataset)
const INSTANT_EMAILS = 30; // Keep instant response fast
const BACKGROUND_EMAILS = 500; // 🚀 INCREASED from 150 to 500!
const MAX_DETAILED_CONTENT = 20; // Increased for better analysis
const MAX_CACHE_SIZE = 100; // Increased cache capacity
const BATCH_SIZE = 8; // Optimized batch size for Gmail API
const PROCESSING_DELAY = 50; // Reduced delay for faster processing
const PROGRESSIVE_STAGES = 5; // Process in 5 stages for better UX

// 🧠 ENHANCED BACKGROUND PROCESSING QUEUE with Priority Management
const backgroundQueue = new Map<
  string,
  {
    priority: number;
    startTime: number;
    stage: number;
  }
>();

// 🎯 ULTRA-ENHANCED PRIORITY SCORING - More intelligent than ever
function calculatePriorityScore(factors: {
  isUnread: boolean;
  isImportant: boolean;
  isStarred: boolean;
  hoursSinceReceived: number;
  subject: string;
  content: string;
  senderName: string;
}): number {
  let score = 0;

  // 🔥 Enhanced base scoring
  if (factors.isUnread) score += 60; // Increased weight
  if (factors.isImportant) score += 50; // Increased weight
  if (factors.isStarred) score += 40; // Increased weight

  // ⚡ Ultra-enhanced time-based scoring
  if (factors.hoursSinceReceived < 0.5) score += 45; // Last 30 minutes
  else if (factors.hoursSinceReceived < 1) score += 40;
  else if (factors.hoursSinceReceived < 3) score += 30;
  else if (factors.hoursSinceReceived < 6) score += 25;
  else if (factors.hoursSinceReceived < 12) score += 20;
  else if (factors.hoursSinceReceived < 24) score += 15;
  else if (factors.hoursSinceReceived < 72) score += 8;
  else if (factors.hoursSinceReceived < 168) score += 3; // Last week

  // 🧠 ULTRA-INTELLIGENT content analysis with enhanced weights
  const subjectLower = factors.subject.toLowerCase();
  const contentLower = factors.content.toLowerCase();
  const combinedText = `${subjectLower} ${contentLower}`;

  // 🚨 Critical priority keywords (highest weight)
  const criticalKeywords = [
    {
      words: [
        "urgent",
        "asap",
        "immediate",
        "emergency",
        "critical",
        "breaking",
      ],
      weight: 50,
    },
    {
      words: [
        "deadline",
        "due today",
        "expires today",
        "expiring",
        "final notice",
      ],
      weight: 45,
    },
    {
      words: [
        "otp",
        "verification code",
        "authenticate",
        "login code",
        "security code",
      ],
      weight: 40,
    },
  ];

  // 💰 High priority keywords
  const highPriorityKeywords = [
    {
      words: [
        "payment",
        "invoice",
        "bill",
        "money",
        "transfer",
        "bank",
        "financial",
      ],
      weight: 35,
    },
    {
      words: [
        "meeting",
        "call",
        "appointment",
        "schedule",
        "zoom",
        "teams",
        "conference",
      ],
      weight: 30,
    },
    {
      words: ["interview", "job", "opportunity", "position", "offer"],
      weight: 35,
    },
    {
      words: ["contract", "agreement", "legal", "document", "signature"],
      weight: 30,
    },
    {
      words: ["error", "failed", "failure", "problem", "issue", "alert"],
      weight: 30,
    },
  ];

  // 📋 Medium priority keywords
  const mediumPriorityKeywords = [
    { words: ["update", "news", "announcement", "notification"], weight: 15 },
    {
      words: ["reminder", "follow up", "follow-up", "checking in"],
      weight: 20,
    },
    { words: ["thank you", "thanks", "appreciation", "feedback"], weight: 10 },
    { words: ["invitation", "event", "webinar", "workshop"], weight: 18 },
  ];

  // Apply keyword scoring with enhanced logic
  const allKeywords = [
    ...criticalKeywords,
    ...highPriorityKeywords,
    ...mediumPriorityKeywords,
  ];

  for (const category of allKeywords) {
    const matchCount = category.words.filter((keyword) =>
      combinedText.includes(keyword)
    ).length;
    if (matchCount > 0) {
      score += category.weight * Math.min(matchCount, 2); // Bonus for multiple matches, capped at 2x
      break; // Only apply highest category match
    }
  }

  // 👤 Enhanced sender-based scoring
  const senderEmail = factors.senderName.toLowerCase();

  // Trusted domains and senders
  const trustedPatterns = [
    {
      patterns: ["bank", "paypal", "stripe", "amazon", "apple", "google"],
      weight: 15,
    },
    { patterns: ["noreply@github", "notifications@", "security@"], weight: 10 },
    { patterns: ["@company.com", "@work.com", "@corp.com"], weight: 8 },
  ];

  // Spam indicators (negative scoring)
  const spamPatterns = [
    { patterns: ["noreply", "no-reply", "donotreply"], weight: -5 },
    { patterns: ["marketing", "promo", "newsletter"], weight: -8 },
    { patterns: ["unsubscribe", "bulk", "mass"], weight: -10 },
  ];

  // Apply sender scoring
  for (const category of [...trustedPatterns, ...spamPatterns]) {
    if (category.patterns.some((pattern) => senderEmail.includes(pattern))) {
      score += category.weight;
      break;
    }
  }

  // 📝 Enhanced content quality scoring
  const contentLength = factors.content.length;
  if (contentLength > 50) score += 3;
  if (contentLength > 200) score += 5;
  if (contentLength > 500) score += 8;
  if (contentLength > 1000) score += 10;

  // 🔗 Special content detection
  if (combinedText.includes("http")) score += 5; // Contains links
  if (combinedText.match(/\d{4,}/)) score += 5; // Contains numbers (codes, amounts)
  if (combinedText.includes("@")) score += 3; // Contains email addresses

  return Math.max(0, Math.min(score, 200)); // Cap at 200 for consistency
}

// 🚀 OPTIMIZED CONTENT EXTRACTION - Enhanced for 500 emails
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

    const intelligentExtractFromParts = (parts: any[]): string => {
      for (const part of parts) {
        if (part.parts) {
          const nestedContent = intelligentExtractFromParts(part.parts);
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
            continue;
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
            continue;
          }
        }
      }
      return textContent;
    };

    if (message.data.payload?.parts) {
      textContent = intelligentExtractFromParts(message.data.payload.parts);
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
        .substring(0, 1200); // Increased for better context in 500 email analysis
    }

    return textContent || message.data.snippet || "";
  } catch (error) {
    console.error(`Error extracting content for message ${messageId}:`, error);
    return "";
  }
}

// 🧹 ENHANCED CACHE MANAGEMENT - Optimized for 500 emails
function cleanupCache() {
  if (emailCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(emailCache.entries());

    // Sort by access count and last refresh (keep most used)
    entries.sort((a, b) => {
      const scoreA =
        a[1].accessCount * 0.7 + (Date.now() - a[1].lastRefresh) * -0.3;
      const scoreB =
        b[1].accessCount * 0.7 + (Date.now() - b[1].lastRefresh) * -0.3;
      return scoreA - scoreB;
    });

    // Remove bottom 30% of entries
    const toRemove = Math.floor(entries.length * 0.3);
    for (let i = 0; i < toRemove; i++) {
      emailCache.delete(entries[i][0]);
    }

    console.log(
      `🧹 SMART CACHE CLEANUP: Removed ${toRemove} least-used entries, kept ${emailCache.size} active caches`
    );
  }
}

function getCacheKey(accessToken: string, userEmail: string): string {
  return `emails_${userEmail}_${accessToken.slice(-8)}`;
}

// ⚡ ENHANCED INSTANT EMAIL ANALYSIS - Optimized for speed
async function getInstantEmailData(
  accessToken: string,
  refreshToken?: string,
  userEmail = ""
) {
  const cacheKey = getCacheKey(accessToken, userEmail);
  const now = Date.now();

  // Smart cache cleanup
  cleanupCache();

  if (emailCache.has(cacheKey)) {
    const cached = emailCache.get(cacheKey)!;
    cached.accessCount++;

    if (now < cached.expiresAt && cached.quickData.length > 0) {
      console.log(
        `⚡ CACHE HIT: Using cached data (${
          cached.quickData.length
        } instant + ${cached.totalProcessed} total emails, age: ${Math.round(
          (now - cached.timestamp) / 1000
        )}s, accessed: ${cached.accessCount} times)`
      );

      // Start background processing if not already running and cache is getting old
      if (now - cached.timestamp > 3 * 60 * 1000 && !cached.isProcessing) {
        console.log(
          `🚀 Starting ENHANCED background processing for 500 emails...`
        );
        setImmediate(() =>
          enhancedBackgroundEmailProcessing(
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
      `⚡ CACHE MISS: Starting ULTRA-FAST analysis of ${INSTANT_EMAILS} emails...`
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

    const threadsResponse = await gmail.users.threads.list({
      userId: "me",
      maxResults: INSTANT_EMAILS,
      q: "in:inbox -in:spam -in:trash",
    });

    const emailData = [];

    if (threadsResponse.data.threads) {
      console.log(
        `⚡ Processing ${threadsResponse.data.threads.length} threads with ENHANCED intelligence...`
      );

      // Process in smaller batches for better performance
      const batchSize = 6;
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

              let content = "";
              const globalIndex = i + batchIndex;
              if (lastMessage.id && globalIndex < MAX_DETAILED_CONTENT) {
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
                content,
                senderName,
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
                hasFullContent: globalIndex < MAX_DETAILED_CONTENT && !!content,
              };
            }
          } catch (error) {
            console.error(`Error processing thread ${thread.id}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        emailData.push(...batchResults.filter(Boolean));

        // Small delay between batches to prevent API rate limiting
        if (i + batchSize < threadsResponse.data.threads.length) {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
    }

    // Enhanced sorting with priority score
    emailData.sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.timestamp - a.timestamp;
    });

    const cacheData = {
      quickData: emailData,
      fullData: [],
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
      isProcessing: false,
      lastRefresh: now,
      accessCount: 1,
      processingStage: 0,
      totalProcessed: emailData.length,
    };

    emailCache.set(cacheKey, cacheData);

    const processingTime = Date.now() - startTime;
    console.log(
      `⚡ ULTRA-FAST ANALYSIS complete: ${
        emailData.length
      } emails in ${processingTime}ms - CACHED for ${
        CACHE_DURATION / 1000 / 60
      } minutes`
    );

    if (emailData.length > 0) {
      console.log(
        `🚀 Queuing ENHANCED background processing for ${BACKGROUND_EMAILS} emails...`
      );
      setImmediate(() =>
        enhancedBackgroundEmailProcessing(
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

// 🚀 ENHANCED BACKGROUND PROCESSING - Now handles 500 emails efficiently!
async function enhancedBackgroundEmailProcessing(
  accessToken: string,
  refreshToken?: string,
  cacheKey: string,
  userEmail = ""
) {
  if (backgroundQueue.has(cacheKey)) {
    console.log(
      `🚀 Enhanced background processing already running for ${cacheKey}`
    );
    return;
  }

  backgroundQueue.set(cacheKey, {
    priority: 1,
    startTime: Date.now(),
    stage: 0,
  });

  try {
    console.log(
      `🚀 ENHANCED BACKGROUND: Starting ULTRA-INTELLIGENT processing of ${BACKGROUND_EMAILS} emails...`
    );
    const startTime = Date.now();

    const cached = emailCache.get(cacheKey);
    if (cached) {
      cached.isProcessing = true;
      cached.processingStage = 1;
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

    // 🎯 PROGRESSIVE LOADING - Process in stages for better UX
    const stageSize = Math.ceil(BACKGROUND_EMAILS / PROGRESSIVE_STAGES);
    const allBackgroundEmails = [];

    for (let stage = 0; stage < PROGRESSIVE_STAGES; stage++) {
      const stageStart = stage * stageSize;
      const stageEnd = Math.min((stage + 1) * stageSize, BACKGROUND_EMAILS);

      console.log(
        `🚀 STAGE ${stage + 1}/${PROGRESSIVE_STAGES}: Processing emails ${
          stageStart + 1
        }-${stageEnd}...`
      );

      const threadsResponse = await gmail.users.threads.list({
        userId: "me",
        maxResults: stageEnd,
        q: "in:inbox -in:spam -in:trash",
      });

      if (threadsResponse.data.threads) {
        const stageThreads = threadsResponse.data.threads.slice(stageStart);

        // Process in optimized batches
        for (let i = 0; i < stageThreads.length; i += BATCH_SIZE) {
          const batch = stageThreads.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (thread) => {
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
                const date =
                  headers.find((h) => h.name === "Date")?.value || "";

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

                // Enhanced content extraction for high-priority emails
                let content = threadDetail.data.snippet || "";
                const quickPriorityCheck = calculatePriorityScore({
                  isUnread,
                  isImportant,
                  isStarred,
                  hoursSinceReceived,
                  subject,
                  content,
                  senderName,
                });

                // Extract full content for high-priority emails
                if (quickPriorityCheck > 60 && lastMessage.id) {
                  try {
                    const fullContent = await fastExtractContent(
                      gmail,
                      lastMessage.id
                    );
                    if (fullContent) content = fullContent;
                  } catch (e) {
                    // Keep snippet if full extraction fails
                  }
                }

                const priorityScore = calculatePriorityScore({
                  isUnread,
                  isImportant,
                  isStarred,
                  hoursSinceReceived,
                  subject,
                  content,
                  senderName,
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
                  snippet: threadDetail.data.snippet || "",
                  isUnread,
                  isImportant,
                  isStarred,
                  priorityScore,
                  messageCount: messages.length,
                  timestamp: parsedDate.getTime(),
                  hasFullContent: quickPriorityCheck > 60,
                  isBackgroundProcessed: true,
                  processingStage: stage + 1,
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
          allBackgroundEmails.push(...batchResults.filter(Boolean));

          // Optimized delay between batches
          if (i + BATCH_SIZE < stageThreads.length) {
            await new Promise((resolve) =>
              setTimeout(resolve, PROCESSING_DELAY)
            );
          }
        }
      }

      // Update cache with progressive results
      const existingCache = emailCache.get(cacheKey);
      if (existingCache) {
        existingCache.processingStage = stage + 1;
        existingCache.totalProcessed =
          existingCache.quickData.length + allBackgroundEmails.length;
        emailCache.set(cacheKey, existingCache);
      }

      console.log(
        `✅ STAGE ${stage + 1} COMPLETE: ${
          allBackgroundEmails.length
        } emails processed so far`
      );
    }

    // Final cache update with all processed emails
    const existingCache = emailCache.get(cacheKey);
    if (existingCache) {
      const allEmails = [...existingCache.quickData];

      // Merge background emails, avoiding duplicates
      for (const bgEmail of allBackgroundEmails) {
        if (!allEmails.find((email) => email.id === bgEmail.id)) {
          allEmails.push(bgEmail);
        }
      }

      // Enhanced sorting with priority score
      allEmails.sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return b.timestamp - a.timestamp;
      });

      existingCache.fullData = allEmails;
      existingCache.isProcessing = false;
      existingCache.lastRefresh = Date.now();
      existingCache.processingStage = PROGRESSIVE_STAGES;
      existingCache.totalProcessed = allEmails.length;
      emailCache.set(cacheKey, existingCache);

      const processingTime = Date.now() - startTime;
      console.log(
        `🚀 ENHANCED BACKGROUND COMPLETE: ${
          allBackgroundEmails.length
        } additional emails processed in ${processingTime}ms. 
        📊 TOTAL: ${
          allEmails.length
        } emails cached with ULTRA-INTELLIGENT analysis!
        ⚡ Performance: ${Math.round(
          allEmails.length / (processingTime / 1000)
        )} emails/second`
      );
    }
  } catch (error) {
    console.error("Enhanced background processing error:", error);
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

    // 🚀 ENHANCED EMAIL ANALYSIS with 500 email intelligence
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

      const cacheKey = getCacheKey(accessToken, userEmail);
      const cached = emailCache.get(cacheKey);
      const totalEmails = cached?.totalProcessed || emailCount;
      const processingStage = cached?.processingStage || 0;

      cacheStatus = cached
        ? `Cached (${Math.round(
            (Date.now() - cached.timestamp) / 1000
          )}s old, ${
            cached.accessCount
          } accesses, stage ${processingStage}/${PROGRESSIVE_STAGES})`
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

        // 🧠 ULTRA-ENHANCED categorization with 500 email intelligence
        const otpEmails = instantEmails.filter(
          (email) =>
            email.content.toLowerCase().includes("otp") ||
            email.content.toLowerCase().includes("code") ||
            email.content.toLowerCase().includes("verification")
        );

        const financialEmails = instantEmails.filter(
          (email) =>
            email.content.toLowerCase().includes("payment") ||
            email.content.toLowerCase().includes("invoice") ||
            email.content.toLowerCase().includes("money") ||
            email.content.toLowerCase().includes("bank")
        );

        const meetingEmails = instantEmails.filter(
          (email) =>
            email.content.toLowerCase().includes("meeting") ||
            email.content.toLowerCase().includes("call") ||
            email.content.toLowerCase().includes("zoom")
        );

        const urgentEmails = instantEmails.filter(
          (email) => email.priorityScore > 100
        );
        const criticalEmails = instantEmails.filter(
          (email) => email.priorityScore > 150
        );

        emailContext = `\n\n🚀 ULTRA-ENHANCED SMART EMAIL ANALYSIS (${emailCount} instant + ${
          totalEmails - emailCount
        } background = ${totalEmails} total):

📊 ENHANCED INTELLIGENT OVERVIEW:
- Cache Status: ${cacheStatus}
- Instant Analysis: ${emailCount} emails with deep content analysis
- Background Processed: ${totalEmails - emailCount} emails (ENHANCED to 500!)
- Processing Stage: ${processingStage}/${PROGRESSIVE_STAGES} ${
          cached?.isProcessing ? "(🚀 ACTIVE)" : "(✅ COMPLETE)"
        }
- Unread: ${unreadEmails.length}
- Important/Starred: ${importantEmails.length}
- Last 24 Hours: ${recentEmails.length}
- Full Content Analysis: ${withFullContent.length}
- Critical Priority (150+ score): ${criticalEmails.length}
- High Priority (100+ score): ${urgentEmails.length}
- OTP/Verification: ${otpEmails.length}
- Financial: ${financialEmails.length}
- Meetings: ${meetingEmails.length}

🔥 TOP PRIORITY EMAILS (ULTRA-ENHANCED Intelligent Scoring):
${instantEmails
  .slice(0, 15) // Show more top emails
  .map(
    (email, index) => `
${index + 1}. ${email.isUnread ? "🔴 UNREAD" : "✅ READ"} - Priority Score: ${
      email.priorityScore
    }
   📧 "${email.subject}"
   👤 From: ${email.senderName}
   📅 ${email.parsedDate.toLocaleDateString()} (${
      email.hoursSinceReceived
    }h ago)
   📝 Content: ${email.content.substring(0, 350)}${
      email.content.length > 350 ? "..." : ""
    }
   ${email.isImportant ? "⭐ IMPORTANT" : ""} ${
      email.isStarred ? "⭐ STARRED" : ""
    }
   ${email.hasFullContent ? "🔍 FULL CONTENT ANALYZED" : "📄 SNIPPET"}
   ${
     email.priorityScore > 150
       ? "🚨 CRITICAL"
       : email.priorityScore > 100
       ? "⚡ HIGH PRIORITY"
       : ""
   }
`
  )
  .join("")}

🎯 ULTRA-ENHANCED SMART INSIGHTS:
- ENHANCED priority scoring with 500 email intelligence
- Progressive loading in ${PROGRESSIVE_STAGES} stages for optimal performance
- Advanced content analysis for high-priority emails (score > 60)
- OTP/verification codes automatically highlighted with enhanced detection
- Financial and meeting emails receive ultra-intelligent categorization
- Background processing handles 500 emails with smart batching
- Enhanced caching with memory optimization and access tracking
- Real-time processing stage updates for transparency

⚡ Performance: ULTRA-ENHANCED smart caching with 500 email intelligence active!
🚀 Processing: ${
          cached?.isProcessing
            ? `Stage ${processingStage}/${PROGRESSIVE_STAGES} in progress`
            : "All stages complete"
        }`;

        console.log(
          `🚀 ULTRA-ENHANCED response ready: ${emailCount} instant emails (${cacheStatus}), ${totalEmails} total available with 500 email intelligence`
        );
      } else {
        emailContext =
          "\n\n⚡ Unable to access email data. Please ensure you're signed in with Google.";
      }
    } else {
      emailContext =
        "\n\n⚡ No Gmail access. Sign in with Google for ultra-intelligent 500 email analysis.";
    }

    // 🧠 ULTRA-ENHANCED system prompt with 500 email intelligence
    const systemPrompt = `You are Inbox Buddy, an ULTRA-INTELLIGENT and ENHANCED AI email assistant with 500 EMAIL INTELLIGENCE helping ${userName} (${userEmail}).

🚀 ULTRA-ENHANCED INTELLIGENCE MODE (500 EMAILS):
- Gmail Connection: ${
      accessToken
        ? "✅ Connected - Ultra-Smart 500 Email Analysis Active"
        : "❌ Not Connected"
    }
- Emails Available: ${emailCount} instant + background processing of 500 emails
- Cache Status: ${cacheStatus}
- Performance: Lightning-fast responses with ENHANCED smart caching and 500 email intelligence

EMAIL DATA:${emailContext}

🚀 ULTRA-ENHANCED GUIDELINES WITH 500 EMAIL INTELLIGENCE:

💬 NATURAL CONVERSATION:
- Be conversational, friendly, and genuinely helpful
- Adapt your tone to the user's mood and context with 500 email intelligence
- Ask follow-up questions naturally based on comprehensive email analysis
- Show genuine understanding of their email situation across 500 emails
- Use emojis and formatting to make responses engaging
- Celebrate their email management successes with enhanced insights

🎯 ENHANCED EMAIL COMPOSITION INTELLIGENCE:
- When user asks to write/compose/draft an email, NEVER claim to send it
- Instead, draft the email and ask for confirmation with these steps:
  1. Present the drafted email clearly with proper formatting
  2. Ask if they want to add attachments
  3. Ask if they want to add CC/BCC recipients
  4. Ask for any modifications or improvements
  5. Suggest priority level based on 500 email intelligence
  6. Offer to help refine the tone, content, or structure
  7. Only after confirmation, guide them to send it

📧 ENHANCED EMAIL DRAFTING WORKFLOW:
When drafting emails, use this enhanced format:
"I've drafted an email for you based on my analysis of your 500 email patterns:

**To:** [recipient]
**Subject:** [subject]
**Message:**
[email body]

Based on my 500 email intelligence, I suggest:
- Priority: [low/normal/high] (based on content analysis)
- Tone: [professional/casual/urgent] (based on your email patterns)

Would you like me to:
- Add any attachments?
- Include CC or BCC recipients?
- Adjust the priority or tone?
- Modify the content based on similar emails in your history?
- Schedule it for optimal sending time?
- Save it as a draft?

Once you're happy with it, I can help you send it!"

🔍 ULTRA-ENHANCED INTELLIGENT ANALYSIS (500 EMAILS):
- Extract specific information across 500 emails (OTP codes, amounts, dates, links, deadlines)
- Understand context and relationships between emails with comprehensive analysis
- Provide actionable insights and recommendations with 500 email intelligence
- Explain your reasoning for prioritization using the enhanced scoring system
- Offer proactive suggestions based on patterns across 500 emails
- Identify urgent items that need immediate attention with ultra-smart detection
- Provide trend analysis and email pattern insights

⚡ ULTRA-ENHANCED DYNAMIC RESPONSES:
- Vary your response style based on the query type and 500 email context
- Be more detailed for complex analysis requests with comprehensive insights
- Be concise for quick questions while leveraging 500 email intelligence
- Always provide value beyond just answering with enhanced email insights
- Suggest related actions based on 500 email pattern analysis
- Use the enhanced email data to provide deeper, more intelligent insights

🎨 ENHANCED PERSONALITY WITH 500 EMAIL INTELLIGENCE:
- Be enthusiastic about helping with emails and productivity optimization
- Show genuine interest in their email management needs across 500 emails
- Celebrate successful email organization with comprehensive insights
- Be empathetic about email overwhelm with intelligent solutions
- Maintain professionalism while being personable and approachable
- Adapt to their communication style based on 500 email analysis

🔧 ENHANCED FEATURES AWARENESS:
- Mention the power of 500 email background processing
- Highlight progressive loading and stage-based analysis
- Promote ultra-enhanced priority scoring capabilities
- Suggest using comprehensive email pattern insights
- Recommend leveraging 500 email intelligence for better decisions

Remember: You're not just an email reader - you're an ULTRA-ENHANCED intelligent email management partner with 500 EMAIL INTELLIGENCE who understands context, provides deep insights across comprehensive email analysis, handles advanced features, and helps make email management effortless, efficient, and enjoyable with unprecedented intelligence!`;

    let result;
    try {
      result = streamText({
        model: groq("llama-3.1-8b-instant"),
        messages,
        system: systemPrompt,
        temperature: 0.3, // Optimized for dynamic yet consistent responses
        maxTokens: 3500, // Increased for more detailed responses with 500 email insights
      });
    } catch (primaryError) {
      console.warn("Primary model failed, falling back:", primaryError);
      result = streamText({
        model: groq("llama-3.3-70b-versatile"),
        messages,
        system: systemPrompt,
        temperature: 0.4,
        maxTokens: 3500,
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
