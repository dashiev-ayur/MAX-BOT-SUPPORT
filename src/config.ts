import 'dotenv/config';
import type { Manager } from './types.js';

export const API = 'https://platform-api2.max.ru';
export const TOKEN = process.env.MAX_BOT_TOKEN!;

export const MANAGERS: Manager[] = Array.from({ length: 10 }, (_, i) => i + 1)
    .flatMap((n) => {
        const raw = process.env[`MANAGER_${n}_ID`];
        if (raw === undefined || raw === '') return [];
        const id = Number(raw);
        if (Number.isNaN(id) || id === 0) return [];
        const name = process.env[`MANAGER_${n}_NAME`]?.trim() || `Менеджер ${n}`;
        return [{ id, name }];
    });

const managerIds: number[] = MANAGERS.map((m) => m.id);

export function isManager(userId: number): boolean {
    return managerIds.includes(userId);
}

export function getManagerName(userId: number): string {
    const m = MANAGERS.find((manager) => manager.id === userId);
    return m?.name ?? 'Менеджер';
}
