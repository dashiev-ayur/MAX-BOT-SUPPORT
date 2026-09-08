# CI/CD: GitHub Actions → Ubuntu VDS

Инструкция по настройке непрерывной интеграции и деплоя бота поддержки MAX.

Репозиторий: [dashiev-ayur/MAX-BOT-SUPPORT](https://github.com/dashiev-ayur/MAX-BOT-SUPPORT)

**Стек на сервере (уже установлено):**


| Компонент | Версия / роль                              |
| --------- | ------------------------------------------ |
| Ubuntu    | VDS                                        |
| Node.js   | 24.20.0                                    |
| PM2       | процесс-менеджер бота                      |
| nginx     | reverse proxy на порт 3000                 |
| mc        | файловый менеджер (удобно править конфиги) |


Приложение слушает `0.0.0.0:3000`, вебхук — `POST /webhook`. База SQLite лежит в `db/bot.db` (каталог в `.gitignore`). Секреты — в `.env` на сервере, в git не попадают.

```
GitHub (push в main)
        │
        ▼
GitHub Actions: npm ci → npm run build
        │
        ▼
SSH на VDS → git pull → npm ci → npm run build → pm2 reload
        │
        ▼
nginx :443 → 127.0.0.1:3000 → Fastify /webhook
```

---



## 1. Что сделать один раз на сервере

Подключитесь по SSH:

```bash
ssh root@ВАШ_IP
```

Дальше удобно работать от пользователя `deploy`, а не от `root`.

### 1.1. Пользователь и каталог

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /opt/max-support-bot
chown deploy:deploy /opt/max-support-bot
```

Для компиляции нативного модуля `better-sqlite3`:

```bash
apt update
apt install -y git build-essential python3
```

Переключитесь на `deploy`:

```bash
su - deploy
```



### 1.2. SSH-ключ для GitHub Actions

На **своём компьютере** (не на сервере):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./github-actions-deploy -N ""
```

Появятся два файла:

- `github-actions-deploy` — **приватный** ключ → GitHub Secret `SSH_PRIVATE_KEY`
- `github-actions-deploy.pub` — **публичный** ключ → на сервер

На сервере от пользователя `deploy`:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Вставьте содержимое `github-actions-deploy.pub` одной строкой, сохраните.

```bash
chmod 600 ~/.ssh/authorized_keys
```

Проверка: ключ должен пускать вас на сервер **без пароля**.

1. Откройте терминал на **своём компьютере** (Mac), не на VDS.
2. Перейдите в папку, где лежат файлы ключа (туда, где вы запускали `ssh-keygen`). Например, если ключ в домашней папке:

```bash
cd ~
```

1. Подставьте IP сервера вместо `203.0.113.10` и выполните:

```bash
ssh -i ./github-actions-deploy deploy@81.26.185.101
```

Флаг `-i` говорит SSH: «войти этим ключом», а не обычным `id_ed25519` из `~/.ssh`.

**Успех:** сразу откроется сессия пользователя `deploy` на Ubuntu, пароль не спросят. В приглашении будет что-то вроде `deploy@имя-сервера:~$`. Выйдите: `exit`.

**Если просит пароль или** `Permission denied`**:** публичный ключ не попал в `/home/deploy/.ssh/authorized_keys`, или вы указали не тот IP / не тот файл ключа (`-i` должен указывать на файл **без** `.pub`).

### 1.3. Клон репозитория

Это **второй, другой ключ**. Первый (`github-actions-deploy`) вы уже сделали на Mac — им GitHub Actions заходит **на сервер**. Сейчас нужен ключ **на сервере**, чтобы сервер мог качать код **из GitHub**.

| Ключ | Где создаёте | Куда кладёте `.pub` | Зачем |
|------|----------------|---------------------|--------|
| `github-actions-deploy` | Mac | `authorized_keys` на VDS | GitHub → SSH на сервер |
| `github_deploy` | VDS, пользователь `deploy` | GitHub → Deploy keys | Сервер → `git clone` / `git pull` |

Если репозиторий **публичный**, второй ключ не нужен — сразу клонируйте по HTTPS (команда ниже). Если **приватный**:

1. На **сервере** (сессия `deploy@...`, не на Mac) сгенерируйте ключ и выведите публичную часть:

```bash
ssh-keygen -t ed25519 -C "vds-git-pull" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Скопируйте строку целиком (`ssh-ed25519 AAAA... vds-git-pull`). Приватный файл `~/.ssh/github_deploy` **без** `.pub` с сервера никуда не копируйте.

2. GitHub → репозиторий → **Settings → Deploy keys → Add deploy key**
3. Title: `vds-deploy`
4. Key: вставьте скопированную строку `.pub`
5. Галочку **Allow write access** не ставить (достаточно read-only) → **Add key**

На сервере `~/.ssh/config`:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
```

```bash
chmod 600 ~/.ssh/config ~/.ssh/github_deploy
```

Клон:

```bash
git clone git@github.com:dashiev-ayur/MAX-BOT-SUPPORT.git /opt/max-support-bot
cd /opt/max-support-bot
```

Если репозиторий публичный, достаточно:

```bash
git clone https://github.com/dashiev-ayur/MAX-BOT-SUPPORT.git /opt/max-support-bot
cd /opt/max-support-bot
```



### 1.4. `.env` на сервере

Файл не коммитится. Создайте его вручную (через `nano` или `mc`):

```bash
nano /opt/max-support-bot/.env
```

```env
MAX_BOT_TOKEN=ваш_токен
MANAGER_1_ID=111111
MANAGER_1_NAME=Имя
# MANAGER_2_ID=222222
# MANAGER_2_NAME=Имя
```

Права:

```bash
chmod 600 /opt/max-support-bot/.env
```

### 1.4.1. Node.js и PM2 для пользователя `deploy`

`nvm` ставит Node **только текущему пользователю**. Если Node 24.20.0 ставили под `root` или другим логином, у `deploy` команд `node` / `npm` / `pm2` не будет.

**Не ставьте** `sudo apt install npm` — это старый системный npm, не ваша 24.20.0.

Проверка (под `deploy`):

```bash
whoami
command -v node; command -v npm; command -v pm2
node -v
```

Если `command not found` — поставьте nvm и ту же версию Node **уже от `deploy`**:

Актуальный релиз nvm — [v0.40.7](https://github.com/nvm-sh/nvm/releases/latest) (проверка: сентябрь 2026). Не ставьте «просто latest с master» — официальный install.sh всегда с тега.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
```

Если хотите всегда подтянуть самый новый тег:

```bash
NVM_VER=$(curl -fsSL https://api.github.com/repos/nvm-sh/nvm/releases/latest | grep -oP '"tag_name":\s*"\K[^"]+')
curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VER}/install.sh" | bash
```

Закройте сессию и зайдите снова (`su - deploy` или SSH), затем:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 24.20.0
nvm alias default 24.20.0
node -v    # v24.20.0
npm -v
npm install -g pm2
pm2 -v
```

GitHub Actions заходит по SSH **без интерактивного shell**, поэтому `.bashrc` с nvm не подхватывается. В скрипте деплоя nvm нужно включать явно (это уже есть в `deploy.yml` ниже):

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
```

Тот же блок выполняйте, если в неинтерактивной сессии снова «npm not found».

### 1.5. Первый запуск через PM2

Сначала загрузите nvm, если `node` ещё не в PATH:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd /opt/max-support-bot
npm ci
npm run build
```

Создайте `ecosystem.config.cjs` (один раз; файл можно закоммитить, см. раздел 4):

```js
module.exports = {
  apps: [
    {
      name: 'max-bot',
      cwd: '/opt/max-support-bot',
      script: 'dist/main.js',
      interpreter: 'node',
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

Запуск:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Автозапуск после перезагрузки VDS (команду подскажет сам PM2 — выполните её от `root`):

```bash
pm2 startup systemd
# скопируйте и выполните выведенную команду от root
pm2 save
```

Проверка:

```bash
pm2 status
pm2 logs max-bot --lines 50
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/webhook
```

Вебхук отвечает на POST; GET может дать `404` — это нормально. Главное, что процесс слушает порт 3000.

### 1.6. nginx

От `root`. Подставьте свой домен:

```bash
nano /etc/nginx/sites-available/max-bot
```

```nginx
server {
    listen 80;
    server_name bot.example.com;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/max-bot /etc/nginx/sites-enabled/max-bot
nginx -t
systemctl reload nginx
```

HTTPS (Let's Encrypt). Если `certbot` ещё нет:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d bot.example.com
```

В кабинете MAX укажите вебхук:

```
https://bot.example.com/webhook
```

Firewall (если включён ufw):

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---



## 2. Секреты в GitHub

Репозиторий → **Settings → Secrets and variables → Actions → New repository secret**.


| Secret            | Значение                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ |
| `SSH_HOST`        | IP или домен VDS                                                                     |
| `SSH_USER`        | `deploy`                                                                             |
| `SSH_PRIVATE_KEY` | целиком содержимое файла `github-actions-deploy` (включая `-----BEGIN` / `-----END`) |
| `SSH_PORT`        | `22`, если порт не меняли                                                            |


Секреты бота (`MAX_BOT_TOKEN`, ID менеджеров) в GitHub **не кладите** — они живут только в `/opt/max-support-bot/.env` на сервере.

---



## 3. Workflows

Создайте в репозитории каталог `.github/workflows/`.

### 3.1. CI — проверка сборки на каждый push и PR

Файл `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - run: npm ci
      - run: npm run build
```



### 3.2. CD — деплой на VDS при пуше в `main`

Файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.2
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script_stop: true
          script: |
            set -euo pipefail
            export NVM_DIR="$HOME/.nvm"
            . "$NVM_DIR/nvm.sh"
            cd /opt/max-support-bot

            git fetch origin main
            git reset --hard origin/main

            npm ci
            npm run build

            pm2 reload ecosystem.config.cjs --update-env
            pm2 save
            pm2 status max-bot
```

`git reset --hard` обновляет код, но **не трогает** `.env` и `db/bot.db` — они в `.gitignore`.

`pm2 reload` перезапускает процесс без долгого простоя. Если приложения ещё нет в PM2, один раз выполните `pm2 start ecosystem.config.cjs` на сервере вручную.

---



## 4. Файл `ecosystem.config.cjs` в репозитории

Чтобы деплой не зависел от ручной правки на сервере, добавьте `ecosystem.config.cjs` в корень репозитория (содержимое — как в разделе 1.5). После этого `pm2 reload ecosystem.config.cjs` в workflow будет находить конфиг после каждого `git pull`.

---



## 5. Как пользоваться после настройки

1. Коммитите и пушите в `main` (или через PR).
2. Вкладка **Actions** в GitHub: сначала job **CI**, затем **Deploy**.
3. На сервере при необходимости: `pm2 logs max-bot`.

Ручной деплой без GitHub (если нужно срочно):

```bash
ssh deploy@ВАШ_IP
cd /opt/max-support-bot
git pull origin main
npm ci
npm run build
pm2 reload ecosystem.config.cjs --update-env
```

Через `mc` удобно смотреть `.env`, логи PM2 (`~/.pm2/logs/`) и конфиг nginx (`/etc/nginx/sites-available/max-bot`).

---



## 6. Что нельзя ломать при деплое


| Путь                        | Почему                                                          |
| --------------------------- | --------------------------------------------------------------- |
| `/opt/max-support-bot/.env` | токен бота и менеджеры                                          |
| `/opt/max-support-bot/db/`  | SQLite: вопросы и ответы. Каталог в `.gitignore`                |
| `node_modules/`             | пересобирается `npm ci` на сервере (нужно для `better-sqlite3`) |


Бэкап БД перед рискованными изменениями:

```bash
cp /opt/max-support-bot/db/bot.db /opt/max-support-bot/db/bot.db.bak-$(date +%F)
```

---



## 7. Частые проблемы

**Deploy: Permission denied (publickey)**  
В секрет попал публичный ключ вместо приватного, или публичный ключ не в `~deploy/.ssh/authorized_keys`.

**Deploy: Host key verification failed**  
`appleboy/ssh-action` сам добавляет host key. Если ошибка остаётся — проверьте `SSH_HOST` и порт.

**git: Permission denied** на сервере  
Для приватного репозитория не настроен Deploy Key / `~/.ssh/config`.

**better-sqlite3: invalid ELF header / Could not locate the bindings file**  
`node_modules` скопировали с Mac/CI. На сервере всегда `npm ci`, не копируйте `node_modules` с другой ОС.

**pm2 reload: Process not found**  
Первый запуск только вручную: `pm2 start ecosystem.config.cjs && pm2 save`.

**Вебхук не доходит**  
Проверьте `https://bot.example.com/webhook` снаружи, `pm2 logs`, `nginx -t`, что MAX указывает именно `/webhook`.

**После деплоя пропали вопросы**  
Бот запущен не из `/opt/max-support-bot` (SQLite создаётся в `process.cwd()/db`). В `ecosystem.config.cjs` обязательно `cwd`.

**Command 'npm' not found** под `deploy`  
nvm стоит у другого пользователя. Не ставьте `apt install npm`. Повторите раздел 1.4.1 от `deploy`. В SSH-деплое должен быть `. "$HOME/.nvm/nvm.sh"`.

**Node не 24-й в GitHub Actions**  
В workflow указано `node-version: '24'` — это только для CI. На VDS используется nvm-установка 24.20.0 у пользователя `deploy`.

---



## 8. Альтернатива: self-hosted runner

Если не хотите открывать SSH с GitHub, поставьте runner **на сам VDS**:

1. GitHub → **Settings → Actions → Runners → New self-hosted runner**
2. Следуйте командам для Linux x64 от пользователя `deploy`
3. В `deploy.yml` замените `runs-on: ubuntu-latest` на `runs-on: self-hosted` и уберите SSH-шаг — job сразу выполняет `git pull` / `npm ci` / `pm2 reload` в `/opt/max-support-bot`

Для одного небольшого бота достаточно схемы из раздела 3 (SSH с `ubuntu-latest`).