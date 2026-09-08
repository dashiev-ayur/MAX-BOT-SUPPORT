import { API, TOKEN, isManager } from './config.js';
import type { MaxSendResponse } from './types.js';

export function logMessage(from: number | 'бот', to: number | 'бот', text: string): void {
    const humanId = from === 'бот' ? to : from;
    const role = typeof humanId === 'number' && isManager(humanId) ? 'менеджер' : 'покупатель';
    const oneLine = text.replace(/\s+/g, ' ').trim();
    console.log(`${from} / ${to} / ${role} / ${oneLine}`);
}

export async function sendToUser(userId: number, text: string): Promise<string | null> {
    logMessage('бот', userId, text);
    const res = await fetch(`${API}/messages?user_id=${userId}`, {
        method: 'POST',
        headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, format: 'html' }),
    });
    const data: MaxSendResponse = (await res.json()) as MaxSendResponse;
    return data?.message?.body?.mid ?? null;
}
