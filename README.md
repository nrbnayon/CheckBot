# AI Email Assistant - Real Gmail Integration

This is a **real** AI email assistant that connects to your actual Gmail account to help you manage your emails intelligently.

## 🚀 Features

- **Real Gmail Access**: Connects to your actual Gmail account via Google OAuth
- **AI-Powered Email Analysis**: Uses AI to determine email importance and priority
- **Smart Email Management**: Automatically categorizes emails by status and importance
- **AI Reply Generation**: Generate contextual replies using AI
- **Email Sending**: Send emails directly from the app with attachments
- **Real-time Email Stats**: See actual counts of unread, responded, and pending emails

## 🔧 Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback`
   - Copy the Client ID and Client Secret

### 2. Groq API Setup

1. Go to [Groq Console](https://console.groq.com/)
2. Create an account and get your API key
3. Copy the API key

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
GROQ_API_KEY=your_groq_api_key_here
NODE_ENV=development
```

### 4. Install and Run

```bash
npm install
npm run dev
```

## 🔐 Authentication Flow

1. Click "Continue with Google" on the login page
2. Grant permissions for Gmail access
3. You'll be redirected to the dashboard with your real emails

## 📧 Gmail Permissions Required

The app requests these Gmail scopes:
- `gmail.readonly` - Read your emails
- `gmail.send` - Send emails on your behalf
- `gmail.modify` - Modify email labels and status
- `gmail.compose` - Compose new emails

## 🤖 AI Features

- **Email Importance Detection**: AI analyzes subject, sender, and content to determine priority
- **Smart Reply Generation**: Context-aware email replies
- **Email Categorization**: Automatically sorts emails by status and importance

## 🛡️ Security

- Uses Google OAuth 2.0 for secure authentication
- Tokens are stored in secure HTTP-only cookies
- Automatic token refresh for seamless experience
- No email data is stored on our servers

## 🔧 Troubleshooting

### "This app isn't verified" warning
- This is normal for development apps
- Click "Advanced" → "Go to [app name] (unsafe)" to continue

### No emails showing
1. Check if you're signed in with Google
2. Verify your `.env.local` file has correct credentials
3. Make sure Gmail API is enabled in Google Cloud Console
4. Check browser console for error messages

### Authentication errors
1. Verify redirect URI matches exactly in Google Cloud Console
2. Check that OAuth credentials are correct
3. Try signing out and signing in again

## 📱 Usage

1. **Dashboard**: View your real email threads with AI-powered importance ratings
2. **AI Chat**: Ask questions about your emails and get AI assistance
3. **Email Management**: Mark emails as responded, read, or needing response
4. **Reply Generation**: Use AI to generate professional email replies
5. **Send Emails**: Compose and send emails with attachments

This is a **real email assistant** - not a mockup! It connects to your actual Gmail account and provides genuine AI-powered email management.