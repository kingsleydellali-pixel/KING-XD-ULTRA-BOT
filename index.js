require('dotenv').config();
const express = require('express');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    jidDecode,
    proto,
    getContentType,
    Browsers
} = require('@whiskeysockets/baileys');
const axios = require('axios');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const settings = require('./settings');

// ---------------------- Logger ----------------------
const logger = pino({ level: 'silent' });

// ---------------------- Express Dashboard ----------------------
const app = express();
app.use(express.json());
app.use(express.static('public')); // optional, if you want to serve static files

let qrCodeData = null;   // store QR code as data URL
let pairingCode = null;  // store pairing code string
let connectionState = 'connecting'; // 'connecting', 'open', 'close'

// Dashboard endpoint to get current status
app.get('/status', (req, res) => {
    res.json({
        state: connectionState,
        qr: qrCodeData,
        pairingCode: pairingCode,
    });
});

// Endpoint to request pairing code
app.post('/pair', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'Phone number required' });
    try {
        if (global.sock && connectionState === 'connecting') {
            const code = await global.sock.requestPairingCode(phoneNumber);
            pairingCode = code;
            res.json({ success: true, code });
        } else {
            res.status(400).json({ error: 'Bot is not in connecting state' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Dashboard running on http://localhost:${PORT}`);
});

// Simple HTML dashboard (served at root)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>𝔎𝔦𝔫𝔤_𝔅𝔩𝔢𝔰𝔰 𝔗𝔢𝔠𝔥 WhatsApp Bot Dashboard</title>
        <style>
            body { font-family: Arial; text-align: center; padding: 30px; background: #f0f2f5; }
            #qr { max-width: 300px; margin: 20px auto; }
            input, button { padding: 10px; font-size: 16px; margin: 5px; }
            .status { font-weight: bold; margin: 10px; }
        </style>
    </head>
    <body>
        <h1>🤖 KING-XD-ULTRA BOT WhatsApp Bot Dashboard</h1>
        <div class="status" id="status">Connecting...</div>
        <div id="qr-container">
            <img id="qr" src="" alt="QR Code" style="display:none;">
        </div>
        <div id="pairing-section">
            <h3>Pair with Phone Number</h3>
            <input type="text" id="phone" placeholder="e.g., 1234567890" />
            <button onclick="requestPair()">Get Pairing Code</button>
            <p id="pairing-code"></p>
        </div>
        <script>
            async function pollStatus() {
                const res = await fetch('/status');
                const data = await res.json();
                document.getElementById('status').innerText = data.state;
                if (data.qr) {
                    document.getElementById('qr').src = data.qr;
                    document.getElementById('qr').style.display = 'block';
                } else {
                    document.getElementById('qr').style.display = 'none';
                }
                if (data.pairingCode) {
                    document.getElementById('pairing-code').innerText = 'Pairing Code: ' + data.pairingCode;
                }
            }
            setInterval(pollStatus, 2000);
            pollStatus();

            async function requestPair() {
                const phone = document.getElementById('phone').value;
                const res = await fetch('/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById('pairing-code').innerText = 'Pairing Code: ' + data.code;
                } else {
                    document.getElementById('pairing-code').innerText = 'Error: ' + data.error;
                }
            }
        </script>
    </body>
    </html>
    `);
});

// ---------------------- Helper Functions ----------------------

async function downloadFromUrl(url, options = {}) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        ...options,
    });
    return Buffer.from(response.data, 'binary');
}

async function sendMedia(sock, jid, buffer, type = 'video', caption = '', quoted = null) {
    const msgOptions = {
        caption: caption,
        mimetype: type === 'audio' ? 'audio/mpeg' : 'video/mp4',
    };
    if (type === 'audio') {
        msgOptions.ptt = false; // send as audio file, not voice note
    }
    return await sock.sendMessage(jid, {
        [type]: buffer,
        ...msgOptions,
    }, { quoted });
}

// ---------------------- YouTube Downloader ----------------------
async function downloadYouTubeVideo(url) {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: '18' }); // 360p mp4
    if (!format) throw new Error('No suitable format found');
    const buffer = await new Promise((resolve, reject) => {
        const stream = ytdl(url, { format });
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
    return { buffer, title: info.videoDetails.title };
}

async function downloadYouTubeAudio(url) {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
    if (!format) throw new Error('No audio format found');
    const buffer = await new Promise((resolve, reject) => {
        const stream = ytdl(url, { format });
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
    return { buffer, title: info.videoDetails.title };
}

// ---------------------- Generic API Downloader ----------------------
async function downloadFromAPI(url, platform) {
    // Try multiple free APIs; adjust endpoints as needed
    const apis = [
        `https://api.akuari.my.id/downloader/${platform}?link=${encodeURIComponent(url)}`,
        `https://api.davidcyriltech.my.id/download/${platform}?url=${encodeURIComponent(url)}`,
    ];
    for (const api of apis) {
        try {
            const res = await axios.get(api);
            const data = res.data;
            if (data && (data.url || data.result?.url || data.download_url)) {
                const mediaUrl = data.url || data.result?.url || data.download_url;
                const buffer = await downloadFromUrl(mediaUrl);
                return {
                    buffer,
                    title: data.title || data.result?.title || 'Downloaded media',
                };
            }
        } catch (e) {
            continue;
        }
    }
    throw new Error('All download APIs failed');
}

// ---------------------- AI Auto‑Reply (OpenAI / Gemini) ----------------------
async function generateAIReply(message) {
    if (settings.openaiApiKey) {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: message }],
        }, {
            headers: { 'Authorization': `Bearer ${settings.openaiApiKey}` },
        });
        return res.data.choices[0].message.content;
    } else if (settings.geminiApiKey) {
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${settings.geminiApiKey}`, {
            contents: [{ parts: [{ text: message }] }],
        });
        return res.data.candidates[0].content.parts[0].text;
    }
    return null;
}

// ---------------------- Bot Initialization ----------------------
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
    });

    global.sock = sock;

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            qrcodeTerminal.generate(qr, { small: true });
        }
        if (connection === 'open') {
            connectionState = 'open';
            qrCodeData = null;
            pairingCode = null;
            console.log('✅ Bot connected');
            // Set bot profile picture if provided
            if (settings.botImageUrl) {
                try {
                    const imgBuffer = await downloadFromUrl(settings.botImageUrl);
                    await sock.updateProfilePicture(sock.user.id, imgBuffer);
                } catch (e) { console.error('Failed to update profile picture:', e); }
            }
        } else if (connection === 'close') {
            connectionState = 'close';
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Connection closed. Reconnecting...');
                startBot();
            } else {
                console.log('Logged out. Please re‑authenticate.');
            }
        } else {
            connectionState = 'connecting';
        }
    });

    // ---------------------- Auto‑View Status ----------------------
    if (settings.autoStatus) {
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                    // View status
                    await sock.readMessages([msg.key]);
                }
            }
        });
    }

    // ---------------------- Auto‑React ----------------------
    if (settings.autoReact) {
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe) continue;
                const isGroup = msg.key.remoteJid.endsWith('@g.us');
                if (!isGroup) continue;
                await sock.sendMessage(msg.key.remoteJid, {
                    react: {
                        text: settings.reactEmoji,
                        key: msg.key,
                    },
                });
            }
        });
    }

    // ---------------------- Channel React ----------------------
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            const jid = msg.key.remoteJid;
            if (jid.endsWith('@newsletter')) { // WhatsApp channel
                await sock.sendMessage(jid, {
                    react: {
                        text: settings.channelReactEmoji,
                        key: msg.key,
                    },
                });
            }
        }
    });

    // ---------------------- Anti‑Delete ----------------------
    if (settings.antiDelete) {
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (update.update && update.update.message === null && update.key) {
                    // Message deleted
                    try {
                        const deletedMsg = await sock.loadMessage(update.key.remoteJid, update.key.id);
                        if (deletedMsg && deletedMsg.message) {
                            const contentType = getContentType(deletedMsg.message);
                            let response;
                            if (contentType === 'conversation' || contentType === 'extendedTextMessage') {
                                const text = deletedMsg.message.conversation || deletedMsg.message.extendedTextMessage?.text;
                                response = { text: `🗑️ *Deleted Message Detected*\n\n${text}` };
                            } else {
                                response = { text: '🗑️ *Deleted media detected (content not recoverable)*' };
                            }
                            await sock.sendMessage(update.key.remoteJid, response);
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        });
    }

    // ---------------------- Anti‑Link ----------------------
    if (settings.antiLink) {
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe) continue;
                const jid = msg.key.remoteJid;
                if (!jid.endsWith('@g.us')) continue;
                const groupMetadata = await sock.groupMetadata(jid);
                const senderIsAdmin = groupMetadata.participants.some(p => p.id === msg.key.participant && (p.admin === 'admin' || p.admin === 'superadmin'));
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                const hasLink = /(https?:\/\/[^\s]+)/.test(text) || /(wa\.me\/\S+)/.test(text);
                if (hasLink && !senderIsAdmin && !msg.key.fromMe) {
                    await sock.sendMessage(jid, { text: `❌ @${msg.key.participant.split('@')[0]} removed for sending links!` }, { mentions: [msg.key.participant] });
                    await sock.groupParticipantsUpdate(jid, [msg.key.participant], 'remove');
                }
            }
        });
    }

    // ---------------------- Anti‑Call ----------------------
    if (settings.antiCall) {
        sock.ev.on('call', async (call) => {
            if (call.status === 'offer') {
                await sock.rejectCall(call.id, call.from);
                await sock.sendMessage(call.from, { text: '🚫 Calls are not allowed. Use text commands.' });
            }
        });
    }

    // ---------------------- AI Auto‑Reply ----------------------
    if (settings.autoReplyWithAI) {
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe) continue;
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (text && !text.startsWith(settings.prefix)) {
                    const reply = await generateAIReply(text);
                    if (reply) {
                        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
                    }
                }
            }
        });
    }

    // ---------------------- Command Handler ----------------------
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            if (!text.startsWith(settings.prefix)) continue;
            const [cmd, ...args] = text.slice(settings.prefix.length).trim().split(' ');
            const command = cmd.toLowerCase();
            const jid = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');
            const isOwner = sender === settings.ownerNumber;

            try {
                // ---------------------- Downloader Commands ----------------------
                if (command === 'yt' || command === 'video') {
                    const url = args[0];
                    if (!url) return sock.sendMessage(jid, { text: '❌ Please provide a YouTube URL' });
                    const { buffer, title } = await downloadYouTubeVideo(url);
                    await sendMedia(sock, jid, buffer, 'video', `🎬 ${title}`);
                } else if (command === 'song' || command === 'audio') {
                    const url = args[0];
                    if (!url) return sock.sendMessage(jid, { text: '❌ Please provide a YouTube URL' });
                    const { buffer, title } = await downloadYouTubeAudio(url);
                    await sendMedia(sock, jid, buffer, 'audio', `🎵 ${title}`);
                } else if (command === 'vid' || command === 'ytv') {
                    const query = args.join(' ');
                    if (!query) return sock.sendMessage(jid, { text: '❌ Please provide a search query' });
                    const searchResults = await yts(query);
                    if (!searchResults.videos.length) return sock.sendMessage(jid, { text: 'No results found' });
                    const firstVideo = searchResults.videos[0];
                    const { buffer, title } = await downloadYouTubeVideo(firstVideo.url);
                    await sendMedia(sock, jid, buffer, 'video', `🎬 ${title}`);
                } else if (command === 'yts' || command === 'ytsearch') {
                    const query = args.join(' ');
                    if (!query) return sock.sendMessage(jid, { text: '❌ Please provide a search query' });
                    const searchResults = await yts(query);
                    let reply = '🔍 *YouTube Search Results*\n\n';
                    searchResults.videos.slice(0, 5).forEach((v, i) => {
                        reply += `${i+1}. ${v.title}\n   ⏱ ${v.timestamp} | 👀 ${v.views}\n   🔗 ${v.url}\n\n`;
                    });
                    await sock.sendMessage(jid, { text: reply });
                } else if (command === 'tt' || command === 'tiktok') {
                    const url = args[0];
                    if (!url) return sock.sendMessage(jid, { text: '❌ Please provide a TikTok URL' });
                    const { buffer, title } = await downloadFromAPI(url, 'tiktok');
                    await sendMedia(sock, jid, buffer, 'video', `🎵 ${title}`);
                } else if (command === 'ig' || command === 'instagram') {
                    const url = args[0];
                    if (!url) return sock.sendMessage(jid, { text: '❌ Please provide an Instagram URL' });
                    const { buffer, title } = await downloadFromAPI(url, 'instagram');
                    await sendMedia(sock, jid, buffer, 'video', `📸 ${title}`);
                } else if (command === 'fb' || command === 'facebook') {
                    const url = args[0];
                    if (!url) return sock.sendMessage(jid, { text: '❌ Please provide a Facebook URL' });
                    const { buffer, title } = await downloadFromAPI(url, 'facebook');
                    await sendMedia(sock, jid, buffer, 'video', `📘 ${title}`);
                }

                // ---------------------- Group Management ----------------------
                else if (command === 'kick' && isGroup) {
                    if (!args[0]) return sock.sendMessage(jid, { text: '❌ Mention a user or provide number' });
                    const target = args[0].replace('@', '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(jid, [target], 'remove');
                    await sock.sendMessage(jid, { text: `✅ Removed @${target.split('@')[0]}` }, { mentions: [target] });
                } else if (command === 'add' && isGroup) {
                    const number = args[0].replace(/[^0-9]/g, '');
                    const target = number + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(jid, [target], 'add');
                    await sock.sendMessage(jid, { text: `✅ Added ${number}` });
                } else if (command === 'promote' && isGroup) {
                    if (!args[0]) return sock.sendMessage(jid, { text: '❌ Mention a user' });
                    const target = args[0].replace('@', '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(jid, [target], 'promote');
                    await sock.sendMessage(jid, { text: `✅ Promoted @${target.split('@')[0]}` }, { mentions: [target] });
                } else if (command === 'demote' && isGroup) {
                    if (!args[0]) return sock.sendMessage(jid, { text: '❌ Mention a user' });
                    const target = args[0].replace('@', '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(jid, [target], 'demote');
                    await sock.sendMessage(jid, { text: `✅ Demoted @${target.split('@')[0]}` }, { mentions: [target] });
                } else if (command === 'mute' && isGroup) {
                    // Toggle group settings to only admins can send
                    await sock.groupSettingUpdate(jid, 'announcement');
                    await sock.sendMessage(jid, { text: '🔇 Group muted (only admins can send)' });
                } else if (command === 'unmute' && isGroup) {
                    await sock.groupSettingUpdate(jid, 'not_announcement');
                    await sock.sendMessage(jid, { text: '🔊 Group unmuted (all members can send)' });
                } else if (command === 'gcstatus' || command === 'groupinfo') {
                    if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups' });
                    const metadata = await sock.groupMetadata(jid);
                    const admins = metadata.participants.filter(p => p.admin).map(p => p.id.split('@')[0]).join(', ');
                    const members = metadata.participants.length;
                    await sock.sendMessage(jid, {
                        text: `📊 *Group Info*\n\n` +
                              `*Name:* ${metadata.subject}\n` +
                              `*Description:* ${metadata.desc || 'N/A'}\n` +
                              `*Members:* ${members}\n` +
                              `*Admins:* ${admins || 'N/A'}\n` +
                              `*Created:* ${new Date(metadata.creation * 1000).toLocaleString()}\n` +
                              `*Group ID:* ${jid}`
                    });
                } else if (command === 'link') {
                    if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups' });
                    const code = await sock.groupInviteCode(jid);
                    const link = `https://chat.whatsapp.com/${code}`;
                    await sock.sendMessage(jid, { text: `🔗 *Group Invite Link:*\n${link}` });
                } else if (command === 'revoke') {
                    if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups' });
                    await sock.groupRevokeInvite(jid);
                    await sock.sendMessage(jid, { text: '✅ Group invite link revoked!' });
                }

                // ---------------------- Broadcasting ----------------------
                else if (command === 'tagall' || command === 'tag') {
                    if (!isGroup) return sock.sendMessage(jid, { text: '❌ This command only works in groups' });
                    const metadata = await sock.groupMetadata(jid);
                    const message = args.join(' ') || 'Attention everyone!';
                    let mentions = [];
                    let text = `📢 *${message}*\n\n`;
                    metadata.participants.forEach((p, i) => {
                        mentions.push(p.id);
                        text += `@${p.id.split('@')[0]} `;
                    });
                    await sock.sendMessage(jid, { text, mentions });
                }

                // ---------------------- Misc ----------------------
                else if (command === 'join') {
                    const link = args[0] || settings.channelLink;
                    if (!link) return sock.sendMessage(jid, { text: '❌ No channel link provided' });
                    // Extract invite code from link
                    const code = link.split('/').pop();
                    await sock.groupAcceptInvite(code);
                    await sock.sendMessage(jid, { text: '✅ Joined the channel/group!' });
                } else if (command === 'ping') {
                    await sock.sendMessage(jid, { text: '🏓 Pong!' });
                } else if (command === 'help' || command === 'menu') {
                    const helpText = `
╔════════════════════════╗
      🤖 *${settings.botName}* 🤖
╚════════════════════════╝

📥 *Downloader Commands*
${settings.prefix}yt <url> – YouTube video
${settings.prefix}song <url> – YouTube audio
${settings.prefix}vid <query> – Search & download first YouTube video
${settings.prefix}yts <query> – YouTube search
${settings.prefix}tt <url> – TikTok video (no watermark)
${settings.prefix}ig <url> – Instagram video/reel
${settings.prefix}fb <url> – Facebook video

👑 *Group Manager*
${settings.prefix}kick @user – Remove member
${settings.prefix}add <number> – Add member
${settings.prefix}promote @user – Make admin
${settings.prefix}demote @user – Remove admin
${settings.prefix}mute – Only admins can send
${settings.prefix}unmute – All members can send
${settings.prefix}gcstatus – Group info
${settings.prefix}link – Get invite link
${settings.prefix}revoke – Revoke invite link
${settings.prefix}tagall – Mention all members

🛡️ *Protection*
Anti‑Delete, Anti‑Link, Anti‑Call, Auto‑Status, Auto‑React – active

🌐 *Other*
${settings.prefix}ping – Check bot latency
${settings.prefix}join <link> – Join a group/channel
${settings.prefix}help – Show this menu
`;
                    await sock.sendMessage(jid, { text: helpText });
                }
                // Add more commands as needed...
            } catch (err) {
                console.error('Command error:', err);
                await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
            }
        }
    });

    return sock;
}

// Start the bot
startBot().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
