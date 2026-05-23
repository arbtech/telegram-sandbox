#!/usr/bin/env bun
/**
 * create-session.ts
 *
 * Interactive CLI that authenticates with Telegram and prints a session string
 * you can store as the TG_SESSION repository secret.
 *
 * Usage
 * ─────
 *   bun run create-session.ts
 *
 * You will be prompted for:
 *   • API ID   — from https://my.telegram.org → App configuration
 *   • API Hash — same page
 *   • Phone    — your Telegram account phone number (international format)
 *   • Code     — the one-time code Telegram sends you
 *   • Password — your 2FA password (if enabled); press Enter to skip
 *
 * The resulting session string is printed at the end.
 * Copy it and add it as a repository secret named TG_SESSION.
 */

import { MemoryStorage, TelegramClient } from '@mtcute/bun';
import * as readline from 'readline';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Prompt the user for input.
 * @param question  Text shown before the cursor.
 * @param secret    If true, typed characters are masked with *.
 */
async function ask(question: string): Promise<string> {
  // Simple readline prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Banner ────────────────────────────────────────────────────────────────────

console.log();
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║          Telegram Session Creator  •  @mtcute/bun        ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log();
console.log('  Get your API credentials at https://my.telegram.org');
console.log('  → Log in → API development tools → App configuration');
console.log();

// ── Collect credentials ───────────────────────────────────────────────────────

const rawApiId = await ask('API ID   : ');
const apiHash = await ask('API Hash : ');

const apiId = parseInt(rawApiId, 10);
if (Number.isNaN(apiId) || apiId <= 0) {
  console.error('\n❌  API ID must be a positive integer.');
  process.exit(1);
}
if (!apiHash) {
  console.error('\n❌  API Hash cannot be empty.');
  process.exit(1);
}

console.log();

// ── Authenticate ──────────────────────────────────────────────────────────────

const storage = new MemoryStorage();

const tg = new TelegramClient({ apiId, apiHash, storage });

console.log('Connecting to Telegram…\n');

try {
  const user = await tg.start({
    phone: async () => {
      const phone = await ask('Phone number (with country code, e.g. +1 555 1234): ');
      if (!phone) throw new Error('Phone number is required.');
      return phone;
    },

    code: async () => {
      const code = await ask('Verification code sent by Telegram: ');
      if (!code) throw new Error('Verification code is required.');
      return code;
    },

    password: async () => {
      console.log('2FA is enabled on this account.');
      const pwd = await ask('2FA password (leave blank to abort): ');
      if (!pwd) {
        console.error('\n❌  2FA password is required but was not provided.');
        process.exit(1);
      }
      return pwd;
    },
  });

  const identity = user.username
    ? `@${user.username}`
    : `${user.firstName ?? ''}${user.lastName ? ' ' + user.lastName : ''}`.trim() || String(user.id);

  console.log(`\n✅  Authenticated as ${identity} (id: ${user.id})`);
} catch (err) {
  console.error('\n❌  Authentication failed:', err);
  process.exit(1);
}

// ── Export session string ─────────────────────────────────────────────────────

let sessionString = await tg.exportSession();

await tg.destroy();

if (!sessionString) {
  console.error(
    '\n❌  Could not export the session string.\n' +
      '    Please open an issue or check the @mtcute/bun changelog for the correct export API.',
  );
  process.exit(1);
}

// ── Print result ──────────────────────────────────────────────────────────────

console.log();
console.log('═'.repeat(66));
console.log('  SESSION STRING — copy everything between the dashes below');
console.log('═'.repeat(66));
console.log();
console.log(sessionString);
console.log();
console.log('═'.repeat(66));
console.log();
console.log('  Next steps:');
console.log('  1. Go to your GitHub repo → Settings → Secrets → Actions');
console.log('  2. Create a new secret named  TG_SESSION');
console.log('  3. Paste the string above as its value');
console.log('  4. Also add TG_API_ID and TG_API_HASH as separate secrets');
console.log();
console.log('  ⚠️   Keep this string private — it grants full account access.');
console.log();
