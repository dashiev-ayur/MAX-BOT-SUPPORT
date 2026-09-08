import { randomUUID } from 'node:crypto';
import { getManagerName } from '../config.js';
import { db } from '../db.js';
import { sendToUser } from '../max-api.js';
import type { ManagerMessageRow, MaxMessage, Question } from '../types.js';

export async function handleManagerReply(msg: MaxMessage, managerId: number): Promise<void> {
    if (!msg.link || msg.link.type !== 'reply') {
        await sendToUser(
            managerId,
            '⚠️ Используйте Reply на сообщение с вопросом, чтобы ответить покупателю.',
        );
        return;
    }

    const repliedMid = msg.link.message.mid;
    const managerName = getManagerName(managerId);
    const answerText = msg.body.text ?? '';

    const record = db
        .prepare('SELECT question_id FROM manager_messages WHERE msg_mid = ?')
        .get(repliedMid) as { question_id: string } | undefined;

    if (!record) {
        await sendToUser(managerId, '⚠️ Вопрос не найден. Возможно, он устарел.');
        return;
    }

    const question = db
        .prepare('SELECT * FROM questions WHERE id = ?')
        .get(record.question_id) as Question | undefined;

    if (!question) {
        await sendToUser(managerId, '⚠️ Вопрос не найден в базе.');
        return;
    }

    await sendToUser(question.client_user_id, `💬 <b>${managerName}</b>:\n${answerText}`);

    db.prepare(`
    INSERT INTO answers (id, question_id, manager_id, manager_name, answer_text)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), question.id, managerId, managerName, answerText);

    const otherManagers = db
        .prepare(
            'SELECT DISTINCT manager_id FROM manager_messages WHERE question_id = ? AND manager_id != ?',
        )
        .all(question.id, managerId) as ManagerMessageRow[];

    const noticeText =
        `ℹ️ <b>${managerName}</b> ответил на вопрос от ${question.client_name}.\n\n` +
        `Ответ: ${answerText}`;

    for (const row of otherManagers) {
        await sendToUser(row.manager_id, noticeText);
    }
}
