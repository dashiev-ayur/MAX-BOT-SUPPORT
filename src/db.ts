import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const dbDir = join(process.cwd(), 'db');
mkdirSync(dbDir, { recursive: true });

export const db = new Database(join(dbDir, 'bot.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    client_user_id INTEGER,
    client_name TEXT,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS manager_messages (
    msg_mid TEXT PRIMARY KEY,
    question_id TEXT,
    manager_id INTEGER,
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );
  CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    question_id TEXT,
    manager_id INTEGER,
    manager_name TEXT,
    answer_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
