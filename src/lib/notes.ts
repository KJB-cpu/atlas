// 근육별 개인 메모 — 이 브라우저의 localStorage에만 저장됨.
const KEY = 'atlas.notes.v1';

type NotesMap = Record<string, string>;

function readAll(): NotesMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NotesMap) : {};
  } catch {
    return {};
  }
}

export function getNote(id: string): string {
  return readAll()[id] ?? '';
}

export function setNote(id: string, text: string): void {
  try {
    const all = readAll();
    if (text.trim()) all[id] = text;
    else delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 저장 불가 환경(시크릿 모드 등)에서는 조용히 무시
  }
}

export function noteIds(): Set<string> {
  return new Set(Object.keys(readAll()));
}
