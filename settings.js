require('dotenv').config();

module.exports = {
    // Bot configuration
    prefix: '.',                         // Command prefix
    botName: 'KING-XD-ULTRA BOT',              // Display name
    ownerNumber: '233535502036@s.whatsapp.net', // Owner's WhatsApp ID (with country code, no +)
    botImageUrl: '',                     // URL to bot's profile picture (optional)

    // Protection toggles
    antiDelete: true,                    // Recover deleted messages
    antiLink: true,                      // Remove non‑admins who send group links
    antiCall: true,                      // Auto‑reject incoming calls
    autoStatus: true,                    // Auto‑view all status updates
    autoReact: true,                     // React to messages with an emoji
    reactEmoji: '👍',                    // Emoji used for auto‑react

    // AI Auto‑Reply (optional – set true and provide API key)
    autoReplyWithAI: false,              // If true, bot will reply to every non‑command message
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // Channel features
    channelLink: 'https://whatsapp.com/channel/0029Vb6zdPc5vKAAAY0imG2R', // Auto‑join link
    channelReactEmoji: '❤️',             // Emoji to react on channel messages
};
