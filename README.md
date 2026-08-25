# KING-XD-ULTRA-BOT 🤖
A professional, high-performance WhatsApp bot built with Baileys and Node.js. Packed with a powerful downloader suite, comprehensive group management, robust protection tools, and a modern web dashboard for easy linking. Designed for speed, efficiency, and reliability.

[https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen]
[https://img.shields.io/badge/license-MIT-blue]
[https://render.com/images/deploy-to-render-button.svg]

---

✨ Features

📥 Ultimate Downloader

· YouTube: .yt (video), .song (audio), .vid (search & download), .yts (search)
· TikTok: .tt (no watermark)
· Instagram: .ig (reels/videos)
· Facebook: .fb (videos)

👑 Group Manager

Complete tools to manage your WhatsApp communities:

· Admin Tools: .kick, .add, .promote, .demote, .mute, .unmute
· Group Info: .gcstatus, .groupinfo, .link, .revoke
· Broadcasting: .tagall / .tag
· Anti-ViewOnce: .vv (view deleted view‑once messages)

🛡️ Protection (Settings)

Keep your account and groups safe:

· Anti‑Delete: Automatically detects and recovers deleted messages
· Anti‑Link: Removes non‑admins who share group links
· Anti‑Call: Automatically rejects incoming calls
· Auto‑Status: Automatically views all status updates
· Auto‑React: Interactive reactions to messages
· Auto‑Reply with AI: Optional OpenAI / Gemini powered replies
· Custom Channel React: React to channel messages

🌐 Web Dashboard

Modern, clean interface for linking:

· Dynamic Pairing: Enter your number to get a pairing code instantly
· QR Code: Fallback QR scanning for easy linking
· Status Monitor: Real‑time connection status tracking

---

🚀 Quick Start

Prerequisites

· Node.js 18 or higher
· A WhatsApp account (not banned)
· (Optional) OpenAI or Gemini API key for AI auto‑replies

Local Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/whatsapp-bot.git
   cd whatsapp-bot
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Configure environment variables
   · Copy .env.example to .env and fill in your details:
     ```
     OWNER_NUMBER=1234567890@s.whatsapp.net
     BOT_NAME=MyAwesomeBot
     PREFIX=.
     OPENAI_API_KEY=sk-...      # optional
     GEMINI_API_KEY=AI...       # optional
     CHANNEL_LINK=https://whatsapp.com/channel/your_channel_id  # optional
     ```
4. Run the bot
   ```bash
   npm start
   ```
5. Link your WhatsApp
   · Open the dashboard at http://localhost:3000
   · Either scan the QR code or enter your phone number to receive a pairing code
   · Complete the linking process in WhatsApp (Linked Devices → Link with phone number)

---

☁️ Deploy to Render.com

1. Fork or push this repository to your GitHub account.
2. Click the Deploy to Render button (or use Blueprint with render.yaml).
3. Set environment variables in the Render dashboard:
   · OWNER_NUMBER (required)
   · BOT_NAME (required)
   · PREFIX (default .)
   · OPENAI_API_KEY, GEMINI_API_KEY, CHANNEL_LINK (optional)
4. Deploy – Render will install dependencies and start the bot automatically.
5. Access your dashboard at the provided Render URL and link your WhatsApp.

⚠️ Note: Render’s free tier has ephemeral storage. The bot session will reset after each deploy. For production, consider adding a persistent disk or using a database‑backed auth store.

---

📋 Command List

Command Description
.yt <url> Download YouTube video
.song <url> Download YouTube audio (MP3)
.vid <query> Search & download first YouTube video
.yts <query> Search YouTube (top 5 results)
.tt <url> Download TikTok video (no watermark)
.ig <url> Download Instagram reel/video
.fb <url> Download Facebook video
.kick @user Remove member from group
.add <number> Add member to group
.promote @user Make member an admin
.demote @user Remove admin rights
.mute Only admins can send messages
.unmute All members can send messages
.gcstatus / .groupinfo Show group details
.link Get group invite link
.revoke Revoke group invite link
.tagall / .tag Mention all group members
.join <link> Join a group/channel via invite link
.ping Check bot latency
.help / .menu Show full command menu

---
