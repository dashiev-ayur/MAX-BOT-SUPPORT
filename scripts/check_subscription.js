import 'dotenv/config';

// Перед запуском скрипта нужно установить переменную окружения NODE_EXTRA_CA_CERTS
// export NODE_EXTRA_CA_CERTS=~/russian-ca-bundle.pem

const API = 'https://platform-api2.max.ru';
const TOKEN = process.env.MAX_BOT_TOKEN;

async function checkSubscription() {
  try {
    const endpoint = new URL(`${API}/subscriptions`);
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

checkSubscription();
