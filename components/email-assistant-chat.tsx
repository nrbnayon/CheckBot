"use client";
import type React from "react";
import { useChat } from "ai/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Send,
  Sparkles,
  Mail,
  Paperclip,
  X,
  CheckCircle,
  WifiOff,
  RefreshCw,
  Brain,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Intelligent prompts that encourage natural conversation
const intelligentPrompts = [
  "Can you summarize my last email?",
  "What are the most important emails I need to handle right now?",
  "Are there any OTP codes or verification emails I should know about?",
  "Show me emails from today with actual content",
  "What emails mention money, payments, or financial stuff?",
  "Help me understand what's urgent in my inbox",
  "Are there any emails I should be worried about?",
  "What patterns do you see in my recent emails?",
  "Show me emails from [specific date] with details",
  "Help me prioritize my inbox based on actual content",
];

interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  attachments?: File[];
  scheduleDate?: string;
}

export function EmailAssistantChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    to: "",
    subject: "",
    body: "",
    attachments: [],
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [hasGmailAccess, setHasGmailAccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    append,
  } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content: `Hey ${
          user?.name?.split(" ")[0] || "there"
        }! 👋 I'm **Inbox Buddy**, your truly intelligent AI email assistant.

🧠 **What Makes Me Actually Intelligent:**

✨ **Real Content Analysis:**
- I read the ACTUAL content of your emails, not just subjects
- Extract specific information like OTP codes, amounts, dates, links
- Understand context and meaning, not just keywords
- Provide detailed summaries with actual quotes from your emails

🎯 **Smart Prioritization:**
- Intelligent priority scoring based on content, urgency, and importance
- Focus on what actually matters to you
- Explain WHY something is important
- Provide specific, actionable recommendations

⚡ **Performance & Intelligence Combined:**
- Analyze 150+ emails with full content extraction
- Detailed analysis of your 30 most important emails
- Smart caching for instant responses
- Background processing for fresh data

🔍 **What I Can Actually Do:**
- **"Can you summarize my last email?"** → I'll give you the actual content and context
- **"Show me OTP emails"** → I'll extract the actual codes and tell you what they're for
- **"What's urgent today?"** → I'll analyze content to identify real urgency
- **"Show me emails from June 23rd"** → I'll provide actual content, not just subjects

💬 **Natural Conversation:**
I don't just match keywords - I understand your emails like a human would and explain my reasoning.

Ready to see what a truly intelligent email assistant can do? Ask me anything about your inbox! 🚀`,
      },
    ],
    onError: (error) => {
      console.error("Chat error:", error);
      toast({
        title: "Chat Error",
        description: "There was an issue with the chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check Gmail access status
  useEffect(() => {
    const checkGmailAccess = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setHasGmailAccess(!!data.user);
        }
      } catch (error) {
        setHasGmailAccess(false);
      }
    };

    checkGmailAccess();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 100);
      }
    }
  }, [messages]);

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleRefreshEmails = () => {
    setIsRefreshing(true);
    try {
      append({
        role: "user",
        content:
          "Please refresh my email data and give me your latest intelligent analysis of my inbox.",
      });

      toast({
        title: "✅ Refreshing Email Analysis",
        description: "Getting fresh intelligent insights from your inbox...",
      });
    } catch (error) {
      console.error("Refresh error:", error);
      toast({
        title: "❌ Refresh Failed",
        description: "Unable to refresh email data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 2000);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments((prev) => [...prev, ...files]);

    const fileNames = files.map((f) => f.name).join(", ");
    append({
      role: "user",
      content: `I want to attach these files: ${fileNames}`,
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const openEmailComposer = (to = "", subject = "", body = "") => {
    setEmailDraft({ to, subject, body, attachments: [] });
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailDraft.to || !emailDraft.subject || !emailDraft.body) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append("to", emailDraft.to);
      formData.append("subject", emailDraft.subject);
      formData.append("body", emailDraft.body);

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await fetch("/api/emails/send", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        append({
          role: "assistant",
          content: `**✅ Email Sent Successfully!**

Your email to **${emailDraft.to}** with the subject "**${
            emailDraft.subject
          }**" has been sent through Gmail!

The email contained ${emailDraft.body.length} characters and ${
            attachments.length > 0
              ? `${attachments.length} attachment(s): ${attachments
                  .map((f) => f.name)
                  .join(", ")}`
              : "no attachments"
          }.

What would you like to do next? I can help you with more emails or analyze your inbox further.`,
        });

        toast({
          title: "✅ Email Sent Successfully!",
          description: `Email sent to ${emailDraft.to}`,
        });

        setEmailDraft({ to: "", subject: "", body: "", attachments: [] });
        setAttachments([]);
        setShowEmailDialog(false);
      } else {
        throw new Error(result.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Email send error:", error);
      toast({
        title: "❌ Send Failed",
        description: error.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageContent = (content: string) => {
    return content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  };

  return (
    <div className='h-full flex flex-col'>
      <Card className='flex-1 flex flex-col'>
        <CardHeader className='border-b bg-gradient-to-r from-blue-50 to-purple-50'>
          <CardTitle className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <div className='h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center'>
                  <Brain className='h-5 w-5 text-white' />
                </div>
                <div className='absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center'>
                  <Zap className='h-2 w-2 text-white' />
                </div>
              </div>
              <div>
                <span className='text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
                  Inbox Buddy
                </span>
                <p className='text-sm text-muted-foreground font-normal flex items-center gap-2'>
                  {hasGmailAccess ? (
                    <>
                      <Brain className='h-3 w-3 text-green-500' />
                      Truly Intelligent • Real Content Analysis
                    </>
                  ) : (
                    <>
                      <WifiOff className='h-3 w-3 text-red-500' />
                      Limited access • Sign in for intelligent analysis
                    </>
                  )}
                </p>
              </div>
            </div>

            {hasGmailAccess && (
              <Button
                onClick={handleRefreshEmails}
                disabled={isRefreshing || isLoading}
                size='sm'
                variant='outline'
                className='flex items-center gap-2'
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {isRefreshing ? "Analyzing..." : "Fresh Analysis"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className='flex-1 flex flex-col p-0'>
          {/* Intelligence Status */}
          {hasGmailAccess && (
            <Alert className='m-4 mb-0 border-green-200 bg-green-50'>
              <Brain className='h-4 w-4 text-green-600' />
              <AlertDescription className='text-green-800'>
                <strong>🧠 True Intelligence Active:</strong> I read actual
                email content, extract specific information, and provide
                intelligent insights based on real understanding.
              </AlertDescription>
            </Alert>
          )}

          {/* Gmail Access Status */}
          {!hasGmailAccess && (
            <Alert className='m-4 mb-0'>
              <WifiOff className='h-4 w-4' />
              <AlertDescription>
                <strong>Limited Access:</strong> Sign in with Google to unlock
                intelligent email content analysis.
                <Button
                  onClick={() => (window.location.href = "/api/auth/callback")}
                  size='sm'
                  className='ml-2'
                >
                  Connect Gmail
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <ScrollArea className='flex-1 p-4' ref={scrollAreaRef}>
            <div className='space-y-6'>
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className='h-8 w-8 border-2 border-green-100'>
                      <AvatarFallback className='bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold'>
                        🧠
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white ml-auto"
                        : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 border border-gray-200"
                    }`}
                  >
                    <div
                      className='whitespace-pre-wrap text-sm leading-relaxed'
                      dangerouslySetInnerHTML={{
                        __html: formatMessageContent(message.content),
                      }}
                    />
                    {message.role === "assistant" && index > 0 && (
                      <div className='flex items-center space-x-1 mt-3 pt-2 border-t border-gray-200'>
                        <Brain className='h-3 w-3 text-green-500' />
                        <span className='text-xs text-gray-500'>
                          {hasGmailAccess
                            ? "🧠 Powered by true intelligence with real content analysis"
                            : "Powered by Inbox Buddy AI"}
                        </span>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <Avatar className='h-8 w-8 border-2 border-blue-100'>
                      <AvatarFallback className='bg-gradient-to-br from-green-500 to-teal-600 text-white text-xs font-semibold'>
                        {user?.name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className='flex items-start space-x-3'>
                  <Avatar className='h-8 w-8 border-2 border-green-100'>
                    <AvatarFallback className='bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold'>
                      🧠
                    </AvatarFallback>
                  </Avatar>
                  <div className='bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200'>
                    <div className='flex items-center space-x-2'>
                      <div className='flex space-x-1'>
                        <div className='w-2 h-2 bg-green-500 rounded-full animate-bounce'></div>
                        <div
                          className='w-2 h-2 bg-green-500 rounded-full animate-bounce'
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className='w-2 h-2 bg-green-500 rounded-full animate-bounce'
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span className='text-sm text-gray-600'>
                        🧠 Intelligently analyzing your email content...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Attachments Display */}
          {attachments.length > 0 && (
            <div className='border-t p-4 bg-blue-50'>
              <div className='flex items-center space-x-2 mb-2'>
                <Paperclip className='h-4 w-4 text-blue-600' />
                <span className='text-sm font-medium text-blue-800'>
                  Attachments Ready:
                </span>
              </div>
              <div className='flex flex-wrap gap-2'>
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className='flex items-center space-x-2 bg-white rounded-lg px-3 py-1 border'
                  >
                    <span className='text-sm text-gray-700'>{file.name}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className='text-red-500 hover:text-red-700'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => openEmailComposer()}
                className='mt-2 bg-blue-600 hover:bg-blue-700 text-white'
                size='sm'
              >
                <Mail className='h-4 w-4 mr-2' />
                Compose Email with Attachments
              </Button>
            </div>
          )}

          {/* Intelligent Quick Prompts */}
          {messages.length <= 1 && (
            <div className='border-t p-4 bg-gradient-to-r from-blue-50 to-purple-50'>
              <div className='flex items-center space-x-2 mb-3'>
                <Brain className='h-4 w-4 text-green-500' />
                <span className='text-sm font-medium text-gray-700'>
                  🧠 Try these intelligent email queries:
                </span>
              </div>
              <div className='flex flex-wrap gap-2'>
                {intelligentPrompts.map((prompt, index) => (
                  <Badge
                    key={index}
                    variant='secondary'
                    className='cursor-pointer hover:bg-green-100 hover:text-green-700 transition-colors px-3 py-1'
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className='border-t p-4 bg-white'>
            <form onSubmit={handleSubmit} className='flex space-x-3'>
              <div className='flex-1 relative'>
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder={
                    hasGmailAccess
                      ? "Ask me about your emails... I'll analyze the actual content! 🧠"
                      : "Ask me anything about email management... 💌"
                  }
                  disabled={isLoading}
                  className='pr-20 h-12 text-base border-2 border-gray-200 focus:border-green-400 rounded-xl'
                />
                <div className='absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2'>
                  <button
                    type='button'
                    onClick={() => fileInputRef.current?.click()}
                    className='text-gray-400 hover:text-green-600 transition-colors'
                    title='Attach files'
                  >
                    <Paperclip className='h-4 w-4' />
                  </button>
                  {hasGmailAccess ? (
                    <Brain
                      className='h-4 w-4 text-green-500'
                      title='True Intelligence Active'
                    />
                  ) : (
                    <WifiOff
                      className='h-4 w-4 text-gray-400'
                      title='Limited access'
                    />
                  )}
                </div>
              </div>
              <Button
                type='submit'
                disabled={isLoading || !input.trim()}
                className='h-12 px-6 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 rounded-xl'
              >
                <Send className='h-4 w-4' />
              </Button>
            </form>
            <div className='flex items-center justify-between mt-2 text-xs text-gray-500'>
              <span>
                Press Enter to send • Click 📎 to attach files •
                {hasGmailAccess
                  ? " 🧠 True intelligence active!"
                  : " Sign in for intelligent analysis"}
              </span>
              <div className='flex items-center space-x-1'>
                <div
                  className={`w-2 h-2 rounded-full ${
                    hasGmailAccess ? "bg-green-500" : "bg-gray-400"
                  }`}
                ></div>
                <span>
                  {hasGmailAccess ? "🧠 Intelligent mode" : "Limited access"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        onChange={handleFileUpload}
        accept='.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif'
      />

      {/* Email Compose Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center space-x-2'>
              <Mail className='h-5 w-5 text-blue-600' />
              <span>Compose Email with Inbox Buddy</span>
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='to'>To *</Label>
              <Input
                id='to'
                value={emailDraft.to}
                onChange={(e) =>
                  setEmailDraft((prev) => ({ ...prev, to: e.target.value }))
                }
                placeholder='recipient@example.com'
              />
            </div>
            <div>
              <Label htmlFor='subject'>Subject *</Label>
              <Input
                id='subject'
                value={emailDraft.subject}
                onChange={(e) =>
                  setEmailDraft((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
                placeholder='Email subject'
              />
            </div>
            <div>
              <Label htmlFor='body'>Message *</Label>
              <Textarea
                id='body'
                value={emailDraft.body}
                onChange={(e) =>
                  setEmailDraft((prev) => ({ ...prev, body: e.target.value }))
                }
                rows={8}
                placeholder='Your email message...'
              />
            </div>

            {attachments.length > 0 && (
              <div>
                <Label>Attachments</Label>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className='flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-1'
                    >
                      <span className='text-sm'>{file.name}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className='text-red-500 hover:text-red-700'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <CheckCircle className='h-4 w-4' />
              <AlertDescription>
                <strong>Ready to send:</strong> Inbox Buddy will send this email
                from your Gmail account.
              </AlertDescription>
            </Alert>

            <div className='flex justify-end space-x-2'>
              <Button
                variant='outline'
                onClick={() => setShowEmailDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isSending}>
                {isSending ? (
                  <>
                    <Sparkles className='h-4 w-4 mr-2 animate-spin' />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className='h-4 w-4 mr-2' />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// v12s
