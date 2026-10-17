import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StatementExtension } from "./parse-file";

// Uploaded statements wait here between upload and confirm/cancel. Local disk only: a deployment with
// several instances or an ephemeral filesystem needs object storage behind these three functions instead.
const DIRECTORY = path.resolve(import.meta.dirname, "../../storage/imports");
const KEY_PATTERN = /^[0-9a-f-]{36}\.(csv|xlsx)$/;

function filePath(key: string): string {
  // Keys come back from the database; the pattern check keeps them from ever escaping DIRECTORY.
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid import file key");
  return path.join(DIRECTORY, key);
}

export async function saveImportFile(buffer: Buffer, extension: StatementExtension): Promise<string> {
  const key = `${randomUUID()}.${extension}`;
  await mkdir(DIRECTORY, { recursive: true });
  await writeFile(filePath(key), buffer);
  return key;
}

export function importFileExtension(key: string): StatementExtension {
  return key.endsWith(".xlsx") ? "xlsx" : "csv";
}

export async function readImportFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath(key));
  } catch {
    return null;
  }
}

export async function deleteImportFile(key: string): Promise<void> {
  await rm(filePath(key), { force: true });
}

// Statement files on disk with their last change, for removing the ones nothing refers to any more.
export async function listImportFiles(): Promise<{ key: string; modifiedAt: Date }[]> {
  let names: string[];
  try {
    names = await readdir(DIRECTORY);
  } catch {
    return [];
  }
  const files = [];
  for (const key of names.filter((name) => KEY_PATTERN.test(name))) {
    files.push({ key, modifiedAt: (await stat(filePath(key))).mtime });
  }
  return files;
}
