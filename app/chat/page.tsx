"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { EmailAssistantChat } from "@/components/email-assistant-chat"

export default function ChatPage() {
  return (
    <DashboardLayout>
      <div className="h-full">
        <EmailAssistantChat />
      </div>
    </DashboardLayout>
  )
}
