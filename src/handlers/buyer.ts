import { randomUUID } from 'node:crypto';
import { MANAGERS } from '../config.js';
import { db } from '../db.js';
import { sendToUser } from '../max-api.js';

export async function handleBuyerQuestion(
    buyerId: number,
    buyerName: string,
    text: string,
): Promise<void> {
    const questionId = randomUUID();

    db.prepare(`
    INSERT INTO questions (id, client_user_id, client_name, text)
    VALUES (?, ?, ?, ?)
  `).run(questionId, buyerId, buyerName, text);

    const forwardText = `📩 <b>Новый вопрос от ${buyerName}</b> (ID: ${buyerId})\n\n${text}`;

    for (const manager of MANAGERS) {
        const mid = await sendToUser(manager.id, forwardText);
        if (mid) {
            db.prepare(`
        INSERT INTO manager_messages (msg_mid, question_id, manager_id)
        VALUES (?, ?, ?)
      `).run(mid, questionId, manager.id);
        }
    }

    await sendToUser(buyerId, 'Ваш вопрос передан менеджерам ⏳ Ожидайте ответа.');
}
