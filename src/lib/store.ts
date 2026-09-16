import type { LetterRecord } from "./types";

const KEY = "sabi.folder.v1";
const CHANGE_EVENT = "sabi:folder-changed";

/**
 * Stable empty array. React bails out of re-rendering when a snapshot is
 * referentially identical, so every "nothing here" path must return this
 * exact instance rather than a fresh [].
 */
export const EMPTY_FOLDER: LetterRecord[] = [];

function isBrowser() {
  return typeof window !== "undefined";
}

function parse(raw: string | null): LetterRecord[] {
  if (!raw) return EMPTY_FOLDER;
  try {
    const parsed = JSON.parse(raw) as LetterRecord[];
    return Array.isArray(parsed) ? parsed : EMPTY_FOLDER;
  } catch {
    return EMPTY_FOLDER;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Cache the parsed folder against the raw string. The snapshot function runs on
// every render pass, so returning a freshly parsed array each time would make
// useSyncExternalStore see a new reference forever and re-render in a loop.
let cachedRaw: string | null = null;
let cachedFolder: LetterRecord[] = EMPTY_FOLDER;

/** Current family folder. Safe to call during render. */
export function folderSnapshot(): LetterRecord[] {
  if (!isBrowser()) return EMPTY_FOLDER;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedFolder = parse(raw);
  }
  return cachedFolder;
}

/** Server/hydration snapshot — must stay referentially stable. */
export function serverFolderSnapshot(): LetterRecord[] {
  return EMPTY_FOLDER;
}

/**
 * Subscribe to folder changes. The browser's "storage" event only fires in
 * *other* tabs, so same-tab writes also emit CHANGE_EVENT from saveLetter().
 */
export function subscribeFolder(onChange: () => void): () => void {
  if (!isBrowser()) return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function listLetters(): LetterRecord[] {
  return folderSnapshot();
}

export function getLetter(id: string): LetterRecord | undefined {
  return listLetters().find((l) => l.id === id);
}

export function saveLetter(record: LetterRecord): void {
  if (!isBrowser()) return;
  const all = listLetters().filter((l) => l.id !== record.id);
  all.unshift(record);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
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
