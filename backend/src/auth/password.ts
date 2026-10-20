import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;

// Each hash costs about 32 MB and a noticeable slice of CPU. A flood of sign-in or sign-up requests must not
// queue up without end and starve everything else, so only a few run at once and only so many may wait;
// past that the request is refused straight away with PasswordCheckBusyError.
const MAX_RUNNING = 4;
const MAX_WAITING = 32;
let running = 0;
const waiting: (() => void)[] = [];

export class PasswordCheckBusyError extends Error {}
// What the form says when PasswordCheckBusyError refused the request.
export const PASSWORD_CHECK_BUSY_MESSAGE = "Hệ thống đang bận. Hãy thử lại sau ít giây.";

async function acquireSlot(): Promise<void> {
  if (running < MAX_RUNNING) {
    running += 1;
    return;
  }
  if (waiting.length >= MAX_WAITING) throw new PasswordCheckBusyError("Too many password checks waiting");
  // The slot is handed over directly by releaseSlot, so `running` stays as it is.
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) next();
  else running -= 1;
}

async function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  await acquireSlot();
  try {
    return await new Promise((resolve, reject) => {
      scrypt(password, salt, keyLength, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    });
  } finally {
    releaseSlot();
  }
}

// Format: scrypt$N$r$p$salt$key — params are stored so they can be raised later without breaking old hashes.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, key] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !key) return false;

  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

// Spends the same time as a real check so login timing does not reveal whether an email is registered.
export async function simulatePasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}
