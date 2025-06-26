"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Clock,
  CheckCircle,
  Mail,
  MoreHorizontal,
  Sparkles,
  Eye,
  Send,
  Copy,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface EmailThread {
  id: string
  subject: string
  sender: string
  snippet: string
  timestamp: string
  status: "need_response" | "responded" | "read"
  importance: "high" | "medium" | "low"
  unreadCount: number
}

interface EmailThreadCardProps {
  thread: EmailThread
  onStatusChange: (threadId: string, status: EmailThread["status"]) => void
}

export function EmailThreadCard({ thread, onStatusChange }: EmailThreadCardProps) {
  const { toast } = useToast()
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [generatedReply, setGeneratedReply] = useState("")
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [emailDetails, setEmailDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showSendConfirmation, setShowSendConfirmation] = useState(false)

  const getStatusIcon = (status: EmailThread["status"]) => {
    switch (status) {
      case "need_response":
        return <Clock className="h-4 w-4 text-orange-500" />
      case "responded":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "read":
        return <Mail className="h-4 w-4 text-blue-500" />
    }
  }

  const getStatusColor = (status: EmailThread["status"]) => {
    switch (status) {
      case "need_response":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "responded":
        return "bg-green-100 text-green-800 border-green-200"
      case "read":
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  const getImportanceColor = (importance: EmailThread["importance"]) => {
    switch (importance) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const fetchEmailDetails = async () => {
    setLoadingDetails(true)
    try {
      const response = await fetch(`/api/emails/threads/${thread.id}`)
      if (response.ok) {
        const data = await response.json()
        setEmailDetails(data)
      } else {
        throw new Error("Failed to fetch email details")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load email details",
        variant: "destructive",
      })
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleViewDetails = async () => {
    setIsDetailDialogOpen(true)
    if (!emailDetails) {
      await fetchEmailDetails()
    }
  }

  const generateReply = async () => {
    setIsGeneratingReply(true)
    try {
      const emailContent = emailDetails
        ? `Subject: ${emailDetails.subject}\nFrom: ${emailDetails.sender}\n\n${emailDetails.body}`
        : `Subject: ${thread.subject}\nFrom: ${thread.sender}\n\n${thread.snippet}`

      const response = await fetch("/api/emails/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailContent,
          context: `This is a ${thread.importance} priority email from ${thread.sender}. Please generate a professional, contextually appropriate response that matches the tone and urgency of the original email.`,
          threadId: thread.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedReply(data.reply)
        setIsReplyDialogOpen(true)
      } else {
        throw new Error("Failed to generate reply")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate reply. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingReply(false)
    }
  }

  const regenerateReply = async () => {
    await generateReply()
  }

  const copyReply = () => {
    navigator.clipboard.writeText(generatedReply)
    toast({
      title: "Copied!",
      description: "Reply copied to clipboard",
    })
  }

  const handleSendClick = () => {
    setShowSendConfirmation(true)
  }

  const confirmSendReply = async () => {
    try {
      const response = await fetch("/api/emails/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          replyContent: generatedReply,
          subject: `Re: ${thread.subject}`,
        }),
      })

      if (response.ok) {
        toast({
          title: "✅ Email Sent Successfully!",
          description: "Your reply has been sent via Inbox Buddy",
        })
        onStatusChange(thread.id, "responded")
        setIsReplyDialogOpen(false)
        setShowSendConfirmation(false)
      } else {
        throw new Error("Failed to send reply")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1" onClick={handleViewDetails}>
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-xs">
                  {thread.sender
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-sm truncate group-hover:text-blue-600 transition-colors">
                    {thread.subject}
                  </h3>
                  {thread.unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {thread.unreadCount} new
                    </Badge>
                  )}
                  {thread.importance === "high" && (
                    <Badge className="text-xs bg-red-100 text-red-800 border-red-200">🔥 AI: High Priority</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{thread.sender}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{thread.snippet}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge className={`text-xs ${getImportanceColor(thread.importance)}`}>AI: {thread.importance}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(thread.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" onClick={handleViewDetails}>
                <Eye className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onStatusChange(thread.id, "need_response")}>
                    Mark as Need Response
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(thread.id, "responded")}>
                    Mark as Responded
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(thread.id, "read")}>Mark as Read</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              {getStatusIcon(thread.status)}
              <Badge className={`text-xs ${getStatusColor(thread.status)}`}>{thread.status.replace("_", " ")}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={generateReply} disabled={isGeneratingReply}>
              {isGeneratingReply ? (
                <>
                  <Sparkles className="h-4 w-4 mr-1 animate-spin" />
                  Inbox Buddy...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI Reply
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Email Thread Details</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : emailDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">From</label>
                    <p className="text-sm">{emailDetails.sender}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date</label>
                    <p className="text-sm">{new Date(emailDetails.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject</label>
                  <p className="text-sm font-medium">{emailDetails.subject}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Message</label>
                  <div className="mt-2 p-4 bg-muted rounded-lg">
                    <div className="whitespace-pre-wrap text-sm">{emailDetails.body || emailDetails.snippet}</div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={generateReply} disabled={isGeneratingReply}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Generate Reply with Inbox Buddy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Failed to load email details</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Reply Generation Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span>Inbox Buddy Generated Reply</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reply to: {thread.subject}</label>
            </div>

            {showSendConfirmation && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Confirm Email Send:</strong> Inbox Buddy will send this reply from your email account. Please
                  review the content above and confirm to send.
                </AlertDescription>
              </Alert>
            )}

            <Textarea
              value={generatedReply}
              onChange={(e) => setGeneratedReply(e.target.value)}
              rows={12}
              placeholder="Inbox Buddy will generate your reply here..."
              className="resize-none"
            />

            <div className="flex justify-between">
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={regenerateReply} disabled={isGeneratingReply}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingReply ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={copyReply}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="flex space-x-2">
                {showSendConfirmation ? (
                  <>
                    <Button variant="outline" onClick={() => setShowSendConfirmation(false)}>
                      Cancel
                    </Button>
                    <Button onClick={confirmSendReply} className="bg-green-600 hover:bg-green-700">
                      <Send className="h-4 w-4 mr-1" />
                      Confirm & Send
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsReplyDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSendClick}>
                      <Send className="h-4 w-4 mr-1" />
                      Send Reply
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
