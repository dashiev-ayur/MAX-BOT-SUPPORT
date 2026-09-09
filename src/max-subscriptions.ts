import type { FastifyInstance } from 'fastify';
import { API, TOKEN } from './config.js';

interface SubscribeBody {
    url: string;
    update_types?: string[];
    secret?: string;
}

async function callMaxSubscriptions(
    method: 'GET' | 'POST' | 'DELETE',
    options?: { url?: string; body?: SubscribeBody },
): Promise<{ status: number; data: unknown }> {
    const endpoint = new URL(`${API}/subscriptions`);
    if (method === 'DELETE' && options?.url) {
        endpoint.searchParams.set('url', options.url);
    }

    const res = await fetch(endpoint, {
        method,
        headers: {
            Authorization: TOKEN,
            ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const data: unknown = await res.json();
    return { status: res.status, data };
}

export function registerMaxSubscriptions(fastify: FastifyInstance): void {
    // https://dev.max.ru/docs-api/methods/GET/subscriptions
    fastify.get('/api/max/subscriptions', async (_req, reply) => {
        const { status, data } = await callMaxSubscriptions('GET');
        return reply.code(status).send(data);
    });

    // https://dev.max.ru/docs-api/methods/POST/subscriptions
    fastify.post<{ Body: SubscribeBody }>('/api/max/subscriptions', async (req, reply) => {
        const { status, data } = await callMaxSubscriptions('POST', { body: req.body });
        return reply.code(status).send(data);
    });

    // https://dev.max.ru/docs-api/methods/DELETE/subscriptions
    fastify.delete<{ Querystring: { url?: string } }>(
        '/api/max/subscriptions',
        async (req, reply) => {
            const { status, data } = await callMaxSubscriptions('DELETE', { url: req.query.url });
            return reply.code(status).send(data);
        },
    );
}
