"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Bot, Sparkles, Shield, Info } from "lucide-react"

export function LoginPage() {
  const handleGoogleLogin = () => {
    // Direct to the callback route which will initiate OAuth if no code is present
    window.location.href = "/api/auth/callback"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Features */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">AI Email Assistant</h1>
            <p className="text-xl text-gray-600">Your intelligent email companion powered by AI</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Bot className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Smart Email Management</h3>
                <p className="text-gray-600">AI-powered email organization and priority detection</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Sparkles className="h-6 w-6 text-purple-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Intelligent Replies</h3>
                <p className="text-gray-600">Generate contextual email responses with AI assistance</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Mail className="h-6 w-6 text-green-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Email Chat Assistant</h3>
                <p className="text-gray-600">Chat with AI about your emails and get personalized help</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Shield className="h-6 w-6 text-orange-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Secure & Private</h3>
                <p className="text-gray-600">30-day secure sessions with Google OAuth protection</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login */}
        <div className="space-y-4">
          {/* Development Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Development Mode:</strong> If you see "Google hasn't verified this app", click "Advanced" → "Go to
              [app name] (unsafe)" to continue. This is normal for development apps.
            </AlertDescription>
          </Alert>

          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>Sign in with your Google account to access your AI email assistant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleGoogleLogin} className="w-full h-12 text-base" size="lg">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="text-center text-sm text-gray-500">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </div>
            </CardContent>
          </Card>

          {/* Instructions for bypassing verification */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <h4 className="font-semibold text-blue-900 mb-2">Development App Instructions:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Click "Continue with Google" above</li>
                <li>When you see the warning, click "Advanced"</li>
                <li>Click "Go to [app name] (unsafe)"</li>
                <li>Grant the requested permissions</li>
              </ol>
              <p className="text-xs text-blue-700 mt-2">
                This warning appears because the app is in development mode. Your data is still secure.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
