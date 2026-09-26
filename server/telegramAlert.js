// server/telegramAlert.js - Telegram Bot Notification Engine for Smarty91
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, 'data', 'telegram_config.json');

function loadPersistedConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
            const data = JSON.parse(raw);
            return data || {};
        }
    } catch (e) {
        console.warn('[Telegram Config] Failed to read saved config file:', e.message);
    }
    return {};
}

const saved = loadPersistedConfig();

export const TELEGRAM_CONFIG = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || saved.botToken || '8847373950:AAFn0U8ODizcxzWmrV_5eV832w5kbl6jqPE',
    chatId: process.env.TELEGRAM_CHAT_ID || saved.chatId || '8282793854',
    adminUrl: saved.adminUrl || 'https://smarty911.onrender.com/smarty-secure-master-911-k8x7.html',
    botUsername: saved.botUsername || 'smarty91_alert_bot',
    botFirstName: saved.botFirstName || 'Smarty91 DEV7'
};

export function saveTelegramConfig(updates = {}) {
    if (updates.botToken !== undefined) TELEGRAM_CONFIG.botToken = updates.botToken.trim();
    if (updates.chatId !== undefined) TELEGRAM_CONFIG.chatId = updates.chatId.trim();
    if (updates.adminUrl !== undefined) TELEGRAM_CONFIG.adminUrl = updates.adminUrl.trim();
    if (updates.botUsername !== undefined) TELEGRAM_CONFIG.botUsername = updates.botUsername.trim();
    if (updates.botFirstName !== undefined) TELEGRAM_CONFIG.botFirstName = updates.botFirstName.trim();

    try {
        const dir = path.dirname(CONFIG_FILE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({
            botToken: TELEGRAM_CONFIG.botToken,
            chatId: TELEGRAM_CONFIG.chatId,
            adminUrl: TELEGRAM_CONFIG.adminUrl,
            botUsername: TELEGRAM_CONFIG.botUsername,
            botFirstName: TELEGRAM_CONFIG.botFirstName,
            updatedAt: new Date().toISOString()
        }, null, 2), 'utf8');
        console.log(`[Telegram Config] Persisted to ${CONFIG_FILE_PATH}: chatId=${TELEGRAM_CONFIG.chatId}`);
    } catch (err) {
        console.warn('[Telegram Config] Failed to write config file:', err.message);
    }
}

// Auto-refresh bot info on startup
export async function refreshBotInfo() {
    if (!TELEGRAM_CONFIG.botToken) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/getMe`);
        const data = await res.json();
        if (data.ok && data.result) {
            TELEGRAM_CONFIG.botUsername = data.result.username || TELEGRAM_CONFIG.botUsername;
            TELEGRAM_CONFIG.botFirstName = data.result.first_name || TELEGRAM_CONFIG.botFirstName;
            saveTelegramConfig({});
            return data.result;
        }
    } catch (e) {
        console.warn('[Telegram Alert] Error fetching bot info:', e.message);
    }
    return null;
}
refreshBotInfo();

export async function sendDirectTelegramMessage(targetChatId, text, replyMarkup = null) {
    try {
        const token = TELEGRAM_CONFIG.botToken;
        if (!token || !targetChatId) return { success: false, message: 'Missing token or targetChatId' };

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const body = {
            chat_id: targetChatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        };
        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const resData = await response.json();
        if (!resData.ok) {
            console.warn('[Telegram Alert Direct] API Warning:', resData.description);
        }
        return resData;
    } catch (err) {
        console.warn('[Telegram Alert Direct] Error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function sendTelegramMessage(text, replyMarkup = null) {
    try {
        const token = TELEGRAM_CONFIG.botToken;
        const chatId = TELEGRAM_CONFIG.chatId;
        if (!token || !chatId) return { success: false, message: 'Telegram credentials missing' };

        return await sendDirectTelegramMessage(chatId, text, replyMarkup);
    } catch (err) {
        console.warn('[Telegram Alert] Error sending alert:', err.message);
        return { success: false, error: err.message };
    }
}

export async function editTelegramMessage(chatId, messageId, newText, replyMarkup = null) {
    try {
        const token = TELEGRAM_CONFIG.botToken;
        if (!token) return { success: false, message: 'Bot token missing' };
        
        const url = `https://api.telegram.org/bot${token}/editMessageText`;
        const body = {
            chat_id: chatId,
            message_id: messageId,
            text: newText,
            parse_mode: 'HTML'
        };
        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (err) {
        console.warn('[Telegram Alert] Error editing message:', err.message);
        return { success: false, error: err.message };
    }
}

export async function answerCallbackQuery(callbackQueryId, text) {
    try {
        const token = TELEGRAM_CONFIG.botToken;
        if (!token) return { success: false, message: 'Bot token missing' };
        
        const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text
            })
        });
        return await response.json();
    } catch (err) {
        console.warn('[Telegram Alert] Error answering callback:', err.message);
        return { success: false, error: err.message };
    }
}

export async function notifyNewDeposit({ userId, phone, amount, bonusAmount, utrNumber, channel, txId }) {
    const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    
    const message = `🚨 <b>NEW DEPOSIT REQUEST! (Smarty91)</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> <code>${phone || userId}</code>
💰 <b>Amount:</b> <b>₹${Number(amount).toLocaleString('en-IN')}</b>
🎁 <b>Bonus:</b> ₹${Number(bonusAmount || 0).toLocaleString('en-IN')}
📝 <b>UTR / Ref:</b> <code>${utrNumber || 'N/A'}</code>
💳 <b>Mode:</b> ${channel || 'UPI'}
🆔 <b>Tx ID:</b> <code>${txId}</code>
⏰ <b>Time:</b> ${timeStr} (${dateStr})
━━━━━━━━━━━━━━━━━━━━
👉 <a href="${TELEGRAM_CONFIG.adminUrl}"><b>OPEN ADMIN PANEL TO APPROVE</b></a>`;

    const inlineKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ Approve Deposit', callback_data: `approve_dep_${txId}` },
                { text: '❌ Reject Deposit', callback_data: `reject_dep_${txId}` }
            ]
        ]
    };

    return sendTelegramMessage(message, inlineKeyboard);
}

export async function notifyNewWithdrawal({ userId, phone, amount, accountHolderName, bankName, accountNumber, ifsc, upiId, txId }) {
    const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

    const message = `💸 <b>NEW WITHDRAWAL REQUEST! (Smarty91)</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> <code>${phone || userId}</code>
💰 <b>Amount:</b> <b>₹${Number(amount).toLocaleString('en-IN')}</b>
🏦 <b>Bank Name:</b> ${bankName || 'Bank Transfer'}
👤 <b>A/C Holder:</b> ${accountHolderName || 'User'}
🔢 <b>Account No:</b> <code>${accountNumber || 'N/A'}</code>
🏛 <b>IFSC Code:</b> <code>${ifsc || 'N/A'}</code>
📱 <b>UPI ID:</b> <code>${upiId || 'N/A'}</code>
🆔 <b>Tx ID:</b> <code>${txId}</code>
⏰ <b>Time:</b> ${timeStr} (${dateStr})
━━━━━━━━━━━━━━━━━━━━
👉 <a href="${TELEGRAM_CONFIG.adminUrl}"><b>OPEN ADMIN PANEL TO PROCESS</b></a>`;

    const inlineKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ Approve Payout', callback_data: `approve_wd_${txId}` },
                { text: '❌ Reject Payout', callback_data: `reject_wd_${txId}` }
            ]
        ]
    };

    return sendTelegramMessage(message, inlineKeyboard);
}

export async function notifyNewBet({ mode, periodId, phone, userId, betAmount, totalAmount, selection, selectionLabel, remainingSec, remainingSeconds }) {
    const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const choiceText = selectionLabel || selection || 'N/A';
    const modeUpper = String(mode || '30s').toUpperCase();
    const amountVal = Number(betAmount !== undefined ? betAmount : (totalAmount !== undefined ? totalAmount : 0));
    const secondsLeft = remainingSec !== undefined ? remainingSec : (remainingSeconds !== undefined ? remainingSeconds : 0);

    const message = `🚨 <b>LIVE BET PLACED! (Smarty91)</b>
━━━━━━━━━━━━━━━━━━━━
🎮 <b>Mode:</b> <code>${modeUpper}</code>
🔢 <b>Period ID:</b> <code>${periodId || 'N/A'}</code>
👤 <b>Player:</b> <code>${phone || userId || 'Player'}</code>
💰 <b>Bet Amount:</b> <b>₹${amountVal.toLocaleString('en-IN')}</b>
🎯 <b>Choice:</b> <b>${choiceText}</b>
⏳ <b>Time Left:</b> ~${secondsLeft}s (${timeStr})
━━━━━━━━━━━━━━━━━━━━
⚡ <b>Tap a Number below to Force Outcome:</b>`;

    const inlineKeyboard = {
        inline_keyboard: [
            [
                { text: '0 🟣🔴', callback_data: `override_${mode}_0` },
                { text: '1 🟢', callback_data: `override_${mode}_1` },
                { text: '2 🔴', callback_data: `override_${mode}_2` },
                { text: '3 🟢', callback_data: `override_${mode}_3` },
                { text: '4 🔴', callback_data: `override_${mode}_4` }
            ],
            [
                { text: '5 🟣🟢', callback_data: `override_${mode}_5` },
                { text: '6 🔴', callback_data: `override_${mode}_6` },
                { text: '7 🟢', callback_data: `override_${mode}_7` },
                { text: '8 🔴', callback_data: `override_${mode}_8` },
                { text: '9 🟢', callback_data: `override_${mode}_9` }
            ]
        ]
    };

    return sendTelegramMessage(message, inlineKeyboard);
}
