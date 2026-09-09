import { MANAGERS } from './config.js';
import { sendToUser } from './max-api.js';

function buildRestartMessage(): string {
    const lines = MANAGERS.map((m) => ` - ${m.name} / ${m.id}`).join('\n');
    return `Приложение перезапущено.\nСписок менеджеров:\n${lines}`;
}

export async function notifyManagersOnStart(): Promise<void> {
    const message = buildRestartMessage();
    console.log(message);

    await Promise.all(
        MANAGERS.map(async (manager) => {
            try {
                await sendToUser(manager.id, message);
            } catch (err) {
                console.error(`Не удалось уведомить менеджера ${manager.id}`, err);
            }
        }),
    );
}
