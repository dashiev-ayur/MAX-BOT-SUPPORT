import type { FastifyInstance } from 'fastify';
import { isManager } from './config.js';
import { handleBuyerQuestion } from './handlers/buyer.js';
import { handleManagerReply } from './handlers/manager.js';
import type { MaxUpdate } from './types.js';
import { logMessage, sendToUser } from './max-api.js';

export function registerWebhook(fastify: FastifyInstance): void {
    fastify.post('/webhook', async (req, reply) => {
        const update = req.body as MaxUpdate;

        if (update.update_type === 'bot_started') {
            const userId = update.user!.user_id;
            logMessage(userId, 'бот', 'Начать');
            if (!isManager(userId)) {
                await sendToUser(
                    userId,
                    '👋 Привет! Я бот поддержки. Напишите свой вопрос — мы подключим менеджера.',
                );
            }
            return reply.code(200).send({ ok: true });
        }

        if (update.update_type !== 'message_created') {
            return reply.code(200).send({ ok: true });
        }

        const msg = update.message!;
        const senderId = msg.sender.user_id;
        const senderName = msg.sender.first_name ?? 'Покупатель';
        const text = msg.body.text ?? '';
        logMessage(senderId, 'бот', text);

        if (!isManager(senderId)) {
            await handleBuyerQuestion(senderId, senderName, text);
            return reply.code(200).send({ ok: true });
        }

        if (isManager(senderId)) {
            await handleManagerReply(msg, senderId);
            return reply.code(200).send({ ok: true });
        }

        return reply.code(200).send({ ok: true });
    });
}
