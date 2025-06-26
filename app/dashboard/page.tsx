"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EmailThreadCard } from "@/components/email-thread-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Mail, Clock, CheckCircle } from "lucide-react"
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

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    needResponse: 0,
    responded: 0,
    totalUnread: 0,
  })

  const fetchEmailThreads = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/emails/threads")
      if (response.ok) {
        const data = await response.json()
        setThreads(data.threads)
        setStats(data.stats)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch email threads",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmailThreads()
  }, [])

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
          title: "Success",
          description: "Thread status updated",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update thread status",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
            <p className="text-muted-foreground">Here are your important email threads</p>
          </div>
          <Button onClick={fetchEmailThreads} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need Response</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.needResponse}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Responded</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.responded}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Unread</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.totalUnread}</div>
            </CardContent>
          </Card>
        </div>

        {/* Email Threads - 3 cards per row on large screens */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Important Email Threads</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No important threads found</p>
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
