import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'library-data.json');
const backupsDir = path.join(dataDir, 'backups');

export async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readData() {
  await ensureDataDir();
  if (!fsSync.existsSync(dataFile)) {
    // In a real migration, we assume the data file exists or will be seeded.
    // For now, let's throw if it's missing or handle it gracefully.
    throw new Error('Library data file not found. Ensure data/library-data.json exists.');
  }
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

export async function writeData(data: any) {
  await ensureDataDir();
  data.meta.updatedAt = new Date().toISOString();
  const tmp = `${dataFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, dataFile);
}

export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function isoDateTime(date = new Date()) {
  return date.toISOString();
}

export function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function receiptNumber() {
  return `RCP-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
}

export function studentId(nextNumber: number) {
  return `STU-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;
}

export function parseAmount(value: any) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function normalizeStatus(value: string) {
  const status = String(value || '').toLowerCase();
  if (['paid', 'pending', 'overdue'].includes(status)) return status;
  return 'pending';
}
