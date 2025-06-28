// components\email-assistant-chat.tsx
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  Edit,
  Plus,
  Save,
  Search,
  FileText,
  ImageIcon,
  Copy,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// Enhanced intelligent prompts with more variety
const intelligentPrompts = [
  "What are my most urgent emails right now?",
  "Show me any OTP codes or verification emails",
  "Summarize my important emails from today",
  "Help me draft a professional follow-up email",
  "What financial emails need my attention?",
  "Are there any meeting invitations I should respond to?",
  "Show me emails that mention deadlines or dates",
  "Help me prioritize my inbox intelligently",
  "Draft a thank you email for my recent meeting",
  "What emails from this week need responses?",
  "Find emails with attachments from last week",
  "Show me unread emails from important senders",
];

interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: File[];
  scheduleDate?: string;
  priority?: "low" | "normal" | "high";
}

interface PendingEmailDraft {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  isVisible: boolean;
  priority?: "low" | "normal" | "high";
}

interface FileUploadProgress {
  [key: string]: number;
}

// Email validation utility
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// File size formatter
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
};

// Enhanced file type validation
const validateFileType = (file: File): boolean => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ];
  return allowedTypes.includes(file.type);
};

export function EmailAssistantChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    to: "",
    subject: "",
    body: "",
    attachments: [],
    priority: "normal",
  });
  const [pendingDraft, setPendingDraft] = useState<PendingEmailDraft | null>(
    null
  );
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [hasGmailAccess, setHasGmailAccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress>({});
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<EmailDraft[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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
        content: `Hey ${user?.name?.split(" ")[0] || "there"}! 👋 

I'm **Inbox Buddy**, your ultra-intelligent AI email assistant! I'm here to make your email management effortless and enjoyable.

🧠 **What Makes Me Ultra-Intelligent:**

✨ **Deep Content Analysis:**
- I read and understand the ACTUAL content of your emails
- Extract specific information like OTP codes, amounts, dates, and links
- Understand context, relationships, and urgency levels
- Provide detailed summaries with actual quotes and insights

🎯 **Smart Email Composition:**
- Help you draft professional, personal, or creative emails
- Suggest improvements for tone, clarity, and effectiveness
- Handle attachments, CC/BCC, scheduling, and priorities
- Always ask for your confirmation before sending anything

⚡ **Lightning-Fast Performance:**
- Analyze 150+ emails with full content extraction
- Smart caching for instant responses after first load
- Background processing for comprehensive analysis
- Real-time insights and recommendations

💬 **Natural Conversation:**
- I adapt to your communication style and preferences
- Ask follow-up questions to better understand your needs
- Provide proactive suggestions based on your email patterns
- Celebrate your email management successes!

🔍 **Enhanced Features:**
- **Drag & Drop**: Drop files directly into the chat
- **Email Validation**: Automatic email address validation
- **Draft Saving**: Save drafts for later use
- **Smart Search**: Find specific emails quickly
- **Priority Handling**: Set email priorities automatically

Ready to transform your email experience? Ask me anything! 🚀`,
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

  // Enhanced Gmail access check with retry logic
  const checkGmailAccess = useCallback(async (retries = 3) => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setHasGmailAccess(!!data.user);
        return true;
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => checkGmailAccess(retries - 1), 1000);
      } else {
        setHasGmailAccess(false);
      }
    }
    return false;
  }, []);

  useEffect(() => {
    checkGmailAccess();
  }, [checkGmailAccess]);

  // Enhanced auto-scroll with smooth behavior
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      }
    }
  }, [messages]);

  // Enhanced email draft detection with better pattern matching
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      const content = lastMessage.content;

      // Multiple pattern matching for different email formats
      const patterns = [
        /\*\*To:\*\*\s*(.+?)\n\*\*Subject:\*\*\s*(.+?)\n\*\*Message:\*\*\s*([\s\S]+?)(?=\n\nWould you like|$)/i,
        /To:\s*(.+?)\nSubject:\s*(.+?)\nMessage:\s*([\s\S]+?)(?=\n\nWould you like|$)/i,
        /📧\s*\*\*To:\*\*\s*(.+?)\n📝\s*\*\*Subject:\*\*\s*(.+?)\n📄\s*\*\*Message:\*\*\s*([\s\S]+?)(?=\n\nWould you like|$)/i,
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          const [, to, subject, body] = match;
          setPendingDraft({
            to: to.trim(),
            subject: subject.trim(),
            body: body.trim(),
            isVisible: true,
            priority: "normal",
          });
          break;
        }
      }
    }
  }, [messages]);

  // Drag and drop functionality
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (!dragRef.current?.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        handleFileUpload({ target: { files } } as any);
      }
    };

    const dragElement = dragRef.current;
    if (dragElement) {
      dragElement.addEventListener("dragover", handleDragOver);
      dragElement.addEventListener("dragleave", handleDragLeave);
      dragElement.addEventListener("drop", handleDrop);

      return () => {
        dragElement.removeEventListener("dragover", handleDragOver);
        dragElement.removeEventListener("dragleave", handleDragLeave);
        dragElement.removeEventListener("drop", handleDrop);
      };
    }
  }, []);

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

  // Enhanced file upload with validation and progress
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }
  ) => {
    try {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      // Validate files
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      for (const file of files) {
        // Check file size (max 25MB)
        if (file.size > 25 * 1024 * 1024) {
          invalidFiles.push(`${file.name} (too large - max 25MB)`);
          continue;
        }

        // Check file type
        if (!validateFileType(file)) {
          invalidFiles.push(`${file.name} (unsupported file type)`);
          continue;
        }

        validFiles.push(file);
      }

      // Show validation errors
      if (invalidFiles.length > 0) {
        toast({
          title: "Some files were rejected",
          description: invalidFiles.join(", "),
          variant: "destructive",
        });
      }

      if (validFiles.length > 0) {
        // Simulate upload progress
        for (const file of validFiles) {
          setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

          // Simulate progress
          for (let i = 0; i <= 100; i += 20) {
            setTimeout(() => {
              setUploadProgress((prev) => ({ ...prev, [file.name]: i }));
            }, i * 10);
          }
        }

        setTimeout(() => {
          setAttachments((prev) => [...prev, ...validFiles]);
          setUploadProgress({});

          // Only append message if not in compose modal
          if (!showEmailDialog) {
            const fileNames = validFiles.map((f) => f.name).join(", ");
            append({
              role: "user",
              content: `I want to attach these files to my next email: ${fileNames}`,
            });
          } else {
            toast({
              title: "Files Added",
              description: `Added ${validFiles.length} file(s) to your email`,
            });
          }
        }, 2000);
      }

      // Reset the input
      if ("value" in event.target) {
        event.target.value = "";
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload Error",
        description: "Failed to add files. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const openEmailComposer = (draftData?: PendingEmailDraft) => {
    if (draftData) {
      setEmailDraft({
        to: draftData.to,
        subject: draftData.subject,
        body: draftData.body,
        cc: draftData.cc || "",
        bcc: draftData.bcc || "",
        attachments: attachments,
        priority: draftData.priority || "normal",
      });
    } else {
      setEmailDraft({
        to: "",
        subject: "",
        body: "",
        cc: "",
        bcc: "",
        attachments: attachments,
        priority: "normal",
      });
    }
    setShowEmailDialog(true);
    setPendingDraft(null);
  };

  // Enhanced email validation
  const validateEmailForm = (): string[] => {
    const errors: string[] = [];

    if (!emailDraft.to.trim()) {
      errors.push("Recipient email is required");
    } else {
      const emails = emailDraft.to.split(",").map((e) => e.trim());
      for (const email of emails) {
        if (!validateEmail(email)) {
          errors.push(`Invalid email address: ${email}`);
        }
      }
    }

    if (!emailDraft.subject.trim()) {
      errors.push("Subject is required");
    }

    if (!emailDraft.body.trim()) {
      errors.push("Message body is required");
    }

    if (emailDraft.cc) {
      const ccEmails = emailDraft.cc.split(",").map((e) => e.trim());
      for (const email of ccEmails) {
        if (email && !validateEmail(email)) {
          errors.push(`Invalid CC email address: ${email}`);
        }
      }
    }

    if (emailDraft.bcc) {
      const bccEmails = emailDraft.bcc.split(",").map((e) => e.trim());
      for (const email of bccEmails) {
        if (email && !validateEmail(email)) {
          errors.push(`Invalid BCC email address: ${email}`);
        }
      }
    }

    return errors;
  };

  // Enhanced send email with better error handling
  const handleSendEmail = async () => {
    const validationErrors = validateEmailForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      console.log("Preparing to send email:", {
        to: emailDraft.to,
        subject: emailDraft.subject,
        bodyLength: emailDraft.body.length,
        attachments: attachments.length,
        cc: emailDraft.cc,
        bcc: emailDraft.bcc,
        priority: emailDraft.priority,
      });

      const formData = new FormData();
      formData.append("to", emailDraft.to);
      formData.append("subject", emailDraft.subject);
      formData.append("body", emailDraft.body);

      if (emailDraft.cc) formData.append("cc", emailDraft.cc);
      if (emailDraft.bcc) formData.append("bcc", emailDraft.bcc);
      if (emailDraft.priority) formData.append("priority", emailDraft.priority);

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      console.log("Sending email to /api/emails/send...");

      const response = await fetch("/api/emails/send", {
        method: "POST",
        body: formData,
      });

      console.log("Email send response status:", response.status);

      const result = await response.json();
      console.log("Email send result:", result);

      if (response.ok && result.success) {
        append({
          role: "assistant",
          content: `**✅ Email Sent Successfully!**

Your email has been delivered! Here's what was sent:

📧 **To:** ${emailDraft.to}
${emailDraft.cc ? `📧 **CC:** ${emailDraft.cc}\n` : ""}${
            emailDraft.bcc ? `📧 **BCC:** ${emailDraft.bcc}\n` : ""
          }📝 **Subject:** "${emailDraft.subject}"
📄 **Content:** ${emailDraft.body.length} characters
${
  emailDraft.priority !== "normal"
    ? `⚡ **Priority:** ${(emailDraft.priority ?? "normal").toUpperCase()}\n`
    : ""
}${
            attachments.length > 0
              ? `📎 **Attachments:** ${attachments
                  .map((f) => f.name)
                  .join(", ")}\n`
              : ""
          }
The email was sent through your Gmail account and should arrive shortly.

What would you like to do next? I can help you:
- Draft another email
- Analyze your inbox for responses  
- Set up follow-up reminders
- Organize your sent emails

Just let me know how I can help! 😊`,
        });

        toast({
          title: "✅ Email Sent Successfully!",
          description: `Email sent to ${emailDraft.to}`,
        });

        // Reset form
        setEmailDraft({
          to: "",
          subject: "",
          body: "",
          attachments: [],
          priority: "normal",
        });
        setAttachments([]);
        setShowEmailDialog(false);
        setPendingDraft(null);
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

  // Save draft functionality
  const saveDraft = () => {
    const validationErrors = validateEmailForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Cannot save incomplete draft",
        description: "Please fill in required fields before saving",
        variant: "destructive",
      });
      return;
    }

    const draft = { ...emailDraft, attachments: [...attachments] };
    setSavedDrafts((prev) => [...prev, draft]);
    toast({
      title: "Draft Saved",
      description: "Your email draft has been saved for later",
    });
  };

  // Copy email content
  const copyEmailContent = () => {
    const content = `To: ${emailDraft.to}
Subject: ${emailDraft.subject}

${emailDraft.body}`;

    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: "Copied to Clipboard",
        description: "Email content copied successfully",
      });
    });
  };

  const formatMessageContent = (content: string) => {
    return content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  };

  // Enhanced user confirmation handling
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user") {
      const content = lastMessage.content.toLowerCase().trim();

      // Enhanced confirmation patterns
      const confirmationPatterns = [
        /^(yes|yeah|yep|sure|ok|okay)\s*(send|sent)\s*(it)?$/,
        /^send\s*(it|email)?$/,
        /^(yes|yeah|yep|sure|ok|okay)$/,
      ];

      const isConfirmation = confirmationPatterns.some((pattern) =>
        pattern.test(content)
      );

      if (isConfirmation && pendingDraft && pendingDraft.isVisible) {
        openEmailComposer(pendingDraft);

        setTimeout(() => {
          append({
            role: "assistant",
            content: `Perfect! I've opened the email composer with your draft. Please review the details and click "Send Email" when you're ready.

You can still:
- Add or remove attachments
- Modify the content
- Add CC/BCC recipients  
- Set email priority
- Save as draft for later

The email will be sent from your Gmail account once you click the Send button! 📧`,
          });
        }, 500);
      }
    }
  }, [messages, pendingDraft, append]);

  return (
    <div className='h-full flex flex-col' ref={dragRef}>
      {/* Drag overlay */}
      {isDragging && (
        <div className='fixed inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center'>
          <div className='bg-white rounded-lg p-6 shadow-lg'>
            <div className='flex items-center space-x-3'>
              <Paperclip className='h-8 w-8 text-blue-500' />
              <div>
                <h3 className='font-semibold'>Drop files here</h3>
                <p className='text-sm text-gray-600'>
                  Add attachments to your email
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      Ultra-Intelligent • Enhanced Features Active
                    </>
                  ) : (
                    <>
                      <WifiOff className='h-3 w-3 text-red-500' />
                      Limited access • Sign in for full intelligence
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className='flex items-center space-x-2'>
              {/* Search functionality */}
              <div className='relative'>
                <Search className='absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                <Input
                  placeholder='Search emails...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-8 w-40'
                />
              </div>
              {hasGmailAccess && (
                <Button
                  onClick={handleRefreshEmails}
                  disabled={isRefreshing || isLoading}
                  size='sm'
                  variant='outline'
                  className='flex items-center gap-2 bg-transparent'
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  {isRefreshing ? "Analyzing..." : "Fresh Analysis"}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className='flex-1 flex flex-col p-0'>
          {/* Enhanced Intelligence Status */}
          {hasGmailAccess && (
            <Alert className='m-4 mb-0 border-green-200 bg-green-50'>
              <Brain className='h-4 w-4 text-green-600' />
              <AlertDescription className='text-green-800'>
                <strong>🧠 Ultra-Intelligence Active:</strong> Enhanced with
                drag & drop, email validation, draft saving, smart search, and
                priority handling.
              </AlertDescription>
            </Alert>
          )}

          {/* Gmail Access Status */}
          {!hasGmailAccess && (
            <Alert className='m-4 mb-0'>
              <WifiOff className='h-4 w-4' />
              <AlertDescription>
                <strong>Limited Access:</strong> Sign in with Google to unlock
                ultra-intelligent email analysis and enhanced features.
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
                            ? "🧠 Ultra-intelligent analysis with enhanced features"
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

              {/* Enhanced Pending Email Draft Display */}
              {pendingDraft && pendingDraft.isVisible && (
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mx-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center space-x-2'>
                      <Mail className='h-4 w-4 text-blue-600' />
                      <span className='font-medium text-blue-800'>
                        Email Draft Ready
                      </span>
                      {pendingDraft.priority &&
                        pendingDraft.priority !== "normal" && (
                          <Badge
                            variant={
                              pendingDraft.priority === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {pendingDraft.priority} priority
                          </Badge>
                        )}
                    </div>
                    <Button
                      onClick={() => setPendingDraft(null)}
                      variant='ghost'
                      size='sm'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>

                  <div className='space-y-2 text-sm'>
                    <div>
                      <strong>To:</strong> {pendingDraft.to}
                    </div>
                    <div>
                      <strong>Subject:</strong> {pendingDraft.subject}
                    </div>
                    <div>
                      <strong>Message:</strong>
                    </div>
                    <div className='bg-white p-3 rounded border text-gray-700 max-h-32 overflow-y-auto'>
                      {pendingDraft.body}
                    </div>
                  </div>

                  <div className='flex items-center space-x-2 mt-4'>
                    <Button
                      onClick={() => openEmailComposer(pendingDraft)}
                      className='bg-blue-600 hover:bg-blue-700 text-white'
                      size='sm'
                    >
                      <Edit className='h-4 w-4 mr-2' />
                      Review & Send
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant='outline'
                      size='sm'
                    >
                      <Paperclip className='h-4 w-4 mr-2' />
                      Add Attachments
                    </Button>
                    <Button
                      onClick={() => {
                        append({
                          role: "user",
                          content:
                            "Please modify this email draft - make it more professional and add a call to action.",
                        });
                        setPendingDraft(null);
                      }}
                      variant='outline'
                      size='sm'
                    >
                      <Sparkles className='h-4 w-4 mr-2' />
                      Improve Draft
                    </Button>
                  </div>
                </div>
              )}

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
                        🧠 Ultra-intelligent analysis in progress...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Enhanced Attachments Display with Progress */}
          {(attachments.length > 0 ||
            Object.keys(uploadProgress).length > 0) && (
            <div className='border-t p-4 bg-blue-50'>
              <div className='flex items-center space-x-2 mb-2'>
                <Paperclip className='h-4 w-4 text-blue-600' />
                <span className='text-sm font-medium text-blue-800'>
                  {Object.keys(uploadProgress).length > 0
                    ? "Uploading..."
                    : `Attachments Ready (${attachments.length}):`}
                </span>
              </div>

              {/* Upload Progress */}
              {Object.entries(uploadProgress).map(([fileName, progress]) => (
                <div key={fileName} className='mb-2'>
                  <div className='flex justify-between text-xs text-gray-600 mb-1'>
                    <span>{fileName}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className='h-2' />
                </div>
              ))}

              {/* Attached Files */}
              <div className='flex flex-wrap gap-2'>
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className='flex items-center space-x-2 bg-white rounded-lg px-3 py-2 border'
                  >
                    <div className='flex items-center space-x-2'>
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className='h-4 w-4 text-green-600' />
                      ) : (
                        <FileText className='h-4 w-4 text-blue-600' />
                      )}
                      <div>
                        <span className='text-sm text-gray-700'>
                          {file.name}
                        </span>
                        <div className='text-xs text-gray-500'>
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAttachment(index)}
                      className='text-red-500 hover:text-red-700'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  </div>
                ))}
              </div>

              <div className='flex items-center space-x-2 mt-3'>
                <Button
                  onClick={() => openEmailComposer()}
                  className='bg-blue-600 hover:bg-blue-700 text-white'
                  size='sm'
                >
                  <Mail className='h-4 w-4 mr-2' />
                  Compose Email
                </Button>
                <Button
                  onClick={() => {
                    append({
                      role: "user",
                      content: `Help me draft an email with these ${
                        attachments.length
                      } attachments: ${attachments
                        .map((f) => f.name)
                        .join(", ")}`,
                    });
                  }}
                  variant='outline'
                  size='sm'
                >
                  <Sparkles className='h-4 w-4 mr-2' />
                  AI Draft
                </Button>
              </div>
            </div>
          )}

          {/* Enhanced Quick Prompts */}
          {messages.length <= 1 && (
            <div className='border-t p-4 bg-gradient-to-r from-blue-50 to-purple-50'>
              <div className='flex items-center space-x-2 mb-3'>
                <Brain className='h-4 w-4 text-green-500' />
                <span className='text-sm font-medium text-gray-700'>
                  🧠 Try these ultra-intelligent queries:
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

          {/* Enhanced Input Area */}
          <div className='border-t p-4 bg-white'>
            <form onSubmit={handleSubmit} className='flex space-x-3'>
              <div className='flex-1 relative'>
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder={
                    hasGmailAccess
                      ? "Ask me anything or drag & drop files... I'm ultra-intelligent! 🧠"
                      : "Ask me about email management or request help with drafting... 💌"
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
                      // title='Ultra-Intelligence Active'
                    />
                  ) : (
                    <WifiOff
                      className='h-4 w-4 text-gray-400'
                      // title='Limited access'
                    />
                  )}
                </div>
              </div>
              <Button
                type='submit'
                disabled={isLoading || !input.trim()}
                className='h-12 px-6 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 rounded-xl'
              >
                {isLoading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Send className='h-4 w-4' />
                )}
              </Button>
            </form>
            <div className='flex items-center justify-between mt-2 text-xs text-gray-500'>
              <span>
                Press Enter to send • Drag & drop files • Click 📎 to attach •
                {hasGmailAccess
                  ? " 🧠 Enhanced features active!"
                  : " Sign in for full intelligence"}
              </span>
              <div className='flex items-center space-x-1'>
                <div
                  className={`w-2 h-2 rounded-full ${
                    hasGmailAccess ? "bg-green-500" : "bg-gray-400"
                  }`}
                ></div>
                <span>
                  {hasGmailAccess ? "🧠 Enhanced mode" : "Limited access"}
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
        accept='.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xlsx,.csv'
      />

      {/* Enhanced Email Compose Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className='max-w-4xl max-h-[95vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center space-x-2'>
              <Mail className='h-5 w-5 text-blue-600' />
              <span>Enhanced Email Composer</span>
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='to'>
                  To *{" "}
                  <span className='text-xs text-gray-500'>
                    (comma-separated for multiple)
                  </span>
                </Label>
                <Input
                  id='to'
                  value={emailDraft.to}
                  onChange={(e) =>
                    setEmailDraft((prev) => ({ ...prev, to: e.target.value }))
                  }
                  placeholder='recipient@example.com, another@example.com'
                  className={
                    !validateEmail(emailDraft.to.split(",")[0]?.trim() || "") &&
                    emailDraft.to
                      ? "border-red-300"
                      : ""
                  }
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
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div>
                <Label htmlFor='cc'>CC (Optional)</Label>
                <Input
                  id='cc'
                  value={emailDraft.cc || ""}
                  onChange={(e) =>
                    setEmailDraft((prev) => ({ ...prev, cc: e.target.value }))
                  }
                  placeholder='cc@example.com'
                />
              </div>
              <div>
                <Label htmlFor='bcc'>BCC (Optional)</Label>
                <Input
                  id='bcc'
                  value={emailDraft.bcc || ""}
                  onChange={(e) =>
                    setEmailDraft((prev) => ({ ...prev, bcc: e.target.value }))
                  }
                  placeholder='bcc@example.com'
                />
              </div>
              <div>
                <Label htmlFor='priority'>Priority</Label>
                <select
                  id='priority'
                  value={emailDraft.priority}
                  onChange={(e) =>
                    setEmailDraft((prev) => ({
                      ...prev,
                      priority: e.target.value as "low" | "normal" | "high",
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md'
                >
                  <option value='low'>Low</option>
                  <option value='normal'>Normal</option>
                  <option value='high'>High</option>
                </select>
              </div>
            </div>

            <div>
              <div className='flex items-center justify-between mb-2'>
                <Label htmlFor='body'>Message *</Label>
                <div className='flex items-center space-x-2'>
                  <span className='text-xs text-gray-500'>
                    {emailDraft.body.length} characters
                  </span>
                  <Button
                    type='button'
                    onClick={() => setShowPreview(!showPreview)}
                    variant='ghost'
                    size='sm'
                  >
                    {showPreview ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </div>
              {showPreview ? (
                <div className='border rounded-md p-3 bg-gray-50 min-h-[200px] whitespace-pre-wrap'>
                  {emailDraft.body || "Email preview will appear here..."}
                </div>
              ) : (
                <Textarea
                  id='body'
                  value={emailDraft.body}
                  onChange={(e) =>
                    setEmailDraft((prev) => ({ ...prev, body: e.target.value }))
                  }
                  rows={10}
                  placeholder='Your email message...'
                  className='resize-none'
                />
              )}
            </div>

            {attachments.length > 0 && (
              <div>
                <Label>Attachments ({attachments.length})</Label>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-2 mt-2'>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className='flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2'
                    >
                      <div className='flex items-center space-x-2 flex-1'>
                        {file.type.startsWith("image/") ? (
                          <ImageIcon className='h-4 w-4 text-green-600' />
                        ) : (
                          <FileText className='h-4 w-4 text-blue-600' />
                        )}
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium truncate'>
                            {file.name}
                          </div>
                          <div className='text-xs text-gray-500'>
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(index)}
                        className='text-red-500 hover:text-red-700'
                      >
                        <X className='h-4 w-4' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <CheckCircle className='h-4 w-4' />
              <AlertDescription>
                <strong>Ready to send:</strong> This email will be sent from
                your Gmail account with all specified recipients, attachments,
                and priority level.
              </AlertDescription>
            </Alert>

            <Separator />

            <div className='flex justify-between items-center'>
              <div className='flex items-center space-x-2'>
                <Button
                  type='button'
                  onClick={(e) => {
                    e.preventDefault();
                    try {
                      fileInputRef.current?.click();
                    } catch (error) {
                      console.error("File input error:", error);
                      toast({
                        title: "File Error",
                        description:
                          "Unable to open file selector. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                  variant='outline'
                  size='sm'
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Files
                </Button>
                <Button
                  type='button'
                  onClick={saveDraft}
                  variant='outline'
                  size='sm'
                >
                  <Save className='h-4 w-4 mr-2' />
                  Save Draft
                </Button>
                <Button
                  type='button'
                  onClick={copyEmailContent}
                  variant='outline'
                  size='sm'
                >
                  <Copy className='h-4 w-4 mr-2' />
                  Copy
                </Button>
                <Button
                  type='button'
                  onClick={() => {
                    try {
                      append({
                        role: "user",
                        content: `Please help me improve this email draft:
To: ${emailDraft.to}
Subject: ${emailDraft.subject}
Message: ${emailDraft.body}

Make it more professional and engaging.`,
                      });
                      setShowEmailDialog(false);
                    } catch (error) {
                      console.error("AI Improve error:", error);
                      toast({
                        title: "AI Improve Error",
                        description:
                          "Unable to improve draft. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                  variant='outline'
                  size='sm'
                >
                  <Sparkles className='h-4 w-4 mr-2' />
                  AI Improve
                </Button>
              </div>

              <div className='flex space-x-2'>
                <Button
                  variant='outline'
                  onClick={() => setShowEmailDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl'
                >
                  {isSending ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
