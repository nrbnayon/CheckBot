"use client"

import type React from "react"

import { useChat } from "ai/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Send, Sparkles, Mail, Lightbulb, Heart, Paperclip, X, CheckCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"

const quickPrompts = [
  "Help me draft a professional follow-up email",
  "How should I respond to this urgent request?",
  "Suggest ways to organize my inbox better",
  "Write a polite decline for this meeting request",
  "Help me prioritize my emails for today",
  "Draft a thank you email for a client",
  "Create an email template for common responses",
  "Help me schedule and send this email at the right time",
]

interface EmailDraft {
  to: string
  subject: string
  body: string
  attachments?: File[]
  scheduleDate?: string
}

export function EmailAssistantChat() {
  const { user } = useAuth()
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    to: "",
    subject: "",
    body: "",
    attachments: [],
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, append } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content: `Hey ${user?.name?.split(" ")[0] || "there"}! 👋 I'm **Inbox Buddy**, your personal AI email assistant, and I'm absolutely thrilled to help you conquer your inbox!

Think of me as your dedicated email sidekick who's here 24/7 to make your email life easier and more efficient. Here's what I can do for you:

📧 **Smart Email Management** - I'll help you organize, prioritize, and categorize your emails like a pro
✍️ **Perfect Replies & Drafts** - I can craft responses that hit exactly the right tone and message
📤 **Send & Schedule Emails** - I can actually send emails for you (with your confirmation, of course!)
📎 **File Attachments** - I can help you attach documents and files to your emails
🎯 **Strategic Communication** - Get advice on timing, etiquette, and building better relationships
⚡ **Productivity Boosts** - Discover workflows, templates, and shortcuts that'll save you hours
🔍 **Smart Analysis** - I'll spot important patterns and help you stay on top of what matters most

I can even help you send emails with attachments! Just ask me to draft something, and I'll guide you through adding files and scheduling if needed.

What's your biggest email challenge right now? Drowning in unread messages? Need help with a tricky response? Want to completely transform your email workflow? I'm here to help! 🚀`,
      },
    ],
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }, 100)
      }
    }
  }, [messages])

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setAttachments((prev) => [...prev, ...files])

    // Add message about file attachment
    const fileNames = files.map((f) => f.name).join(", ")
    append({
      role: "user",
      content: `I want to attach these files: ${fileNames}`,
    })
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const openEmailComposer = (to = "", subject = "", body = "") => {
    setEmailDraft({ to, subject, body, attachments: [] })
    setShowEmailDialog(true)
  }

  const handleSendEmail = async () => {
    if (!emailDraft.to || !emailDraft.subject || !emailDraft.body) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append("to", emailDraft.to)
      formData.append("subject", emailDraft.subject)
      formData.append("body", emailDraft.body)

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file)
      })

      console.log("Sending email with data:", {
        to: emailDraft.to,
        subject: emailDraft.subject,
        attachmentCount: attachments.length,
      })

      const response = await fetch("/api/emails/send", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Add success message to chat
        append({
          role: "assistant",
          content: `**✅ Email Sent Successfully!**

**Confirmation Details:**
- **Email Sent:** "${emailDraft.subject}"
- **To:** ${emailDraft.to}
- **Sent Date:** ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
- **Message ID:** ${result.messageId}
- **Attachments:** ${attachments.length > 0 ? attachments.map((f) => f.name).join(", ") : "None"}

Your email has been successfully sent through Gmail! You should see it in your Gmail sent folder, and the recipient will receive it shortly.

**Next Steps:**
What would you like to do next? I can help you with:
1. 📧 Draft another email
2. 📋 Organize your inbox  
3. 📎 Create email templates
4. ⏰ Schedule future emails
5. 📊 Analyze your email patterns

How can I assist you further?`,
        })

        toast({
          title: "✅ Email Sent Successfully!",
          description: `Email sent to ${emailDraft.to}`,
        })

        // Reset form
        setEmailDraft({ to: "", subject: "", body: "", attachments: [] })
        setAttachments([])
        setShowEmailDialog(false)
      } else {
        throw new Error(result.error || "Failed to send email")
      }
    } catch (error: any) {
      console.error("Email send error:", error)

      toast({
        title: "❌ Email Send Failed",
        description: error.message || "Failed to send email. Please try again.",
        variant: "destructive",
      })

      append({
        role: "assistant",
        content: `**❌ Email Send Failed**

I'm sorry, but there was an issue sending your email. Here's what might have happened:

**Possible Issues:**
- Gmail API authentication expired (try refreshing the page)
- Network connectivity problems
- Invalid email address format
- Gmail API rate limits

**What to try:**
1. **Refresh the page** and try again
2. **Check the email address** for typos
3. **Try sending without attachments** first
4. **Contact support** if the issue persists

Would you like me to help you troubleshoot this issue, or shall we try a different approach?`,
      })
    } finally {
      setIsSending(false)
    }
  }

  const formatMessageContent = (content: string) => {
    // Convert **text** to bold
    return content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <CardTitle className="flex items-center space-x-3">
            <div className="relative">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <Heart className="h-2 w-2 text-white" />
              </div>
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Inbox Buddy
              </span>
              <p className="text-sm text-muted-foreground font-normal">
                Your AI email assistant • Online and ready to help
              </p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 border-2 border-blue-100">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold">
                        IB
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
                      className="whitespace-pre-wrap text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                    />
                    {message.role === "assistant" && index > 0 && (
                      <div className="flex items-center space-x-1 mt-3 pt-2 border-t border-gray-200">
                        <Sparkles className="h-3 w-3 text-purple-500" />
                        <span className="text-xs text-gray-500">Powered by Inbox Buddy AI</span>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 border-2 border-blue-100">
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-teal-600 text-white text-xs font-semibold">
                        {user?.name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8 border-2 border-blue-100">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold">
                      IB
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">Inbox Buddy is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Attachments Display */}
          {attachments.length > 0 && (
            <div className="border-t p-4 bg-blue-50">
              <div className="flex items-center space-x-2 mb-2">
                <Paperclip className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Attachments Ready:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 bg-white rounded-lg px-3 py-1 border">
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <button onClick={() => removeAttachment(index)} className="text-red-500 hover:text-red-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => openEmailComposer()}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Mail className="h-4 w-4 mr-2" />
                Compose Email with Attachments
              </Button>
            </div>
          )}

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="border-t p-4 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center space-x-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">Quick starts:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-purple-100 hover:text-purple-700 transition-colors px-3 py-1"
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t p-4 bg-white">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <div className="flex-1 relative">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask Inbox Buddy anything about your emails... I'm here to help! 💌"
                  disabled={isLoading}
                  className="pr-20 h-12 text-base border-2 border-gray-200 focus:border-purple-400 rounded-xl"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-400 hover:text-purple-600 transition-colors"
                    title="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>
                Press Enter to send • Click 📎 to attach files • Inbox Buddy can send emails with confirmation
              </span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Inbox Buddy is online</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
      />

      {/* Email Compose Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <span>Compose Email with Inbox Buddy</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="to">To *</Label>
              <Input
                id="to"
                value={emailDraft.to}
                onChange={(e) => setEmailDraft((prev) => ({ ...prev, to: e.target.value }))}
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={emailDraft.subject}
                onChange={(e) => setEmailDraft((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject"
              />
            </div>
            <div>
              <Label htmlFor="body">Message *</Label>
              <Textarea
                id="body"
                value={emailDraft.body}
                onChange={(e) => setEmailDraft((prev) => ({ ...prev, body: e.target.value }))}
                rows={8}
                placeholder="Your email message..."
              />
            </div>

            {attachments.length > 0 && (
              <div>
                <Label>Attachments</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-1">
                      <span className="text-sm">{file.name}</span>
                      <button onClick={() => removeAttachment(index)} className="text-red-500 hover:text-red-700">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Ready to send:</strong> Inbox Buddy will send this email from your Gmail account. Please review
                all details before confirming.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isSending}>
                {isSending ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
