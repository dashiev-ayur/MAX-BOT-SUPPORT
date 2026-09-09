import Fastify, { type FastifyInstance } from 'fastify';
import { registerMaxSubscriptions } from './max-subscriptions.js';
import { notifyManagersOnStart } from './startup-notify.js';
import { registerWebhook } from './webhook.js';

const fastify: FastifyInstance = Fastify({ logger: true });

registerWebhook(fastify);
// registerMaxSubscriptions(fastify);

const start = async (): Promise<void> => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        fastify.log.info('Bot server running on port 3000');
        await notifyManagersOnStart();
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
