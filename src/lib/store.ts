import type { LetterRecord } from "./types";

const KEY = "sabi.folder.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function listLetters(): LetterRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LetterRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLetter(id: string): LetterRecord | undefined {
  return listLetters().find((l) => l.id === id);
}

export function saveLetter(record: LetterRecord): void {
  if (!isBrowser()) return;
  const all = listLetters().filter((l) => l.id !== record.id);
  all.unshift(record);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateLetter(id: string, patch: Partial<LetterRecord>): LetterRecord | undefined {
  const existing = getLetter(id);
  if (!existing) return undefined;
  const next = { ...existing, ...patch };
  saveLetter(next);
  return next;
}

export function newId(): string {
  if (isBrowser() && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
