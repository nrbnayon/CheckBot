"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EmailThreadCard } from "@/components/email-thread-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Mail, Clock, CheckCircle, AlertTriangle, Wifi, WifiOff } from "lucide-react"
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
  messageCount?: number
  isFromUser?: boolean
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [stats, setStats] = useState({
    needResponse: 0,
    responded: 0,
    totalUnread: 0,
  })

  const fetchEmailThreads = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log("🔄 Fetching real email threads...")
      
      const response = await fetch("/api/emails/threads")
      const data = await response.json()
      
      if (response.ok && data.success) {
        setThreads(data.threads)
        setStats(data.stats)
        setNeedsAuth(false)
        
        toast({
          title: "✅ Real Emails Loaded!",
          description: data.message || `Successfully loaded ${data.threads.length} email threads from your Gmail account`,
        })
        
        console.log("✅ Successfully loaded real email data:", data.threads.length, "threads")
      } else if (data.needsAuth) {
        setNeedsAuth(true)
        setError("Please sign in with Google to access your emails")
      } else {
        throw new Error(data.error || "Failed to fetch emails")
      }
    } catch (error: any) {
      console.error("❌ Error fetching email threads:", error)
      setError(error.message || "Failed to fetch email threads")
      
      toast({
        title: "❌ Error Loading Emails",
        description: error.message || "Failed to fetch your email threads. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchEmailThreads()
    }
  }, [user])

  const handleStatusChange = async (threadId: string, newStatus: EmailThread["status"]) => {
    try {
      const response = await fetch(`/api/emails/threads/${threadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, status: newStatus } : thread)))
        toast({
          title: "✅ Status Updated",
          description: "Thread status updated successfully",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to update thread status",
        variant: "destructive",
      })
    }
  }

  const handleReauth = () => {
    window.location.href = "/api/auth/callback"
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              {needsAuth ? (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  Not connected to Gmail
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  Connected to your real Gmail account
                </>
              )}
            </p>
          </div>
          <Button onClick={fetchEmailThreads} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh Real Emails"}
          </Button>
        </div>

        {/* Authentication Alert */}
        {needsAuth && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>You need to sign in with Google to access your real email data.</span>
              <Button onClick={handleReauth} size="sm">
                Sign In with Google
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && !needsAuth && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
              <br />
              <Button onClick={fetchEmailThreads} size="sm" className="mt-2">
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need Response</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.needResponse}</div>
              <p className="text-xs text-muted-foreground">Real emails requiring attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Responded</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.responded}</div>
              <p className="text-xs text-muted-foreground">Emails you've replied to</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Unread</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.totalUnread}</div>
              <p className="text-xs text-muted-foreground">Unread messages in your inbox</p>
            </CardContent>
          </Card>
        </div>

        {/* Email Threads */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Your Real Email Threads
            {threads.length > 0 && (
              <span className="text-sm text-muted-foreground">({threads.length} loaded from Gmail)</span>
            )}
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-muted-foreground">Loading your real emails from Gmail...</p>
              </div>
            </div>
          ) : threads.length === 0 && !error ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {needsAuth ? "Sign in to view your emails" : "No email threads found"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {threads.map((thread) => (
                <EmailThreadCard key={thread.id} thread={thread} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}