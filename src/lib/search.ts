import type { JointId, Muscle, RegionId } from '../types';
import { expandRoot, rootRank } from '../data/vocab';

export interface Filters {
  query: string;
  region: RegionId | null;
  joint: JointId | null;
  /** joint가 선택됐을 때만 의미 있음 */
  motion: string | null;
  nerve: string | null;
  root: string | null;
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  region: null,
  joint: null,
  motion: null,
  nerve: null,
  root: null,
};

/** 'Obturator nerve (posterior branch)' → 'Obturator nerve' */
export function baseNerve(nerve: string): string {
  return nerve.replace(/\s*\(.*\)\s*$/, '').trim();
}

function haystack(m: Muscle): string {
  return [
    m.name,
    ...(m.aliases ?? []),
    m.group,
    ...m.origin,
    ...m.insertion,
    ...m.actions.map((a) => `${a.joint} ${a.motion}`),
    ...m.innervation.map((n) => `${n.nerve} ${n.roots.join(' ')}`),
    ...m.bloodSupply,
  ]
    .join(' \n ')
    .toLowerCase();
}

const cache = new WeakMap<Muscle, string>();
function hay(m: Muscle): string {
  let h = cache.get(m);
  if (!h) {
    h = haystack(m);
    cache.set(m, h);
  }
  return h;
}

/** 이름 매칭을 우선하는 단순 점수. 모든 토큰이 포함돼야 매치. */
function score(m: Muscle, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const h = hay(m);
  if (!tokens.every((t) => h.includes(t))) return 0;
  const name = [m.name, ...(m.aliases ?? [])].join(' ').toLowerCase();
  let s = 1;
  for (const t of tokens) {
    if (name.startsWith(t)) s += 4;
    else if (name.includes(t)) s += 2;
  }
  return s;
}

export function applyFilters(muscles: Muscle[], f: Filters): Muscle[] {
  const tokens = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { m: Muscle; s: number }[] = [];
  for (const m of muscles) {
    if (f.region && m.region !== f.region) continue;
    if (f.joint) {
      const hit = m.actions.some(
        (a) => a.joint === f.joint && (!f.motion || a.motion === f.motion),
      );
      if (!hit) continue;
    }
    if (f.nerve && !m.innervation.some((n) => baseNerve(n.nerve) === f.nerve)) continue;
    if (f.root && !m.innervation.some((n) => n.roots.flatMap(expandRoot).includes(f.root!))) continue;
    const s = score(m, tokens);
    if (s > 0) scored.push({ m, s });
  }
  if (tokens.length) scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.m);
}

/** 현재 데이터에 실제로 존재하는 선택지만 필터 옵션으로 노출 */
export function facetOptions(muscles: Muscle[], f: Filters) {
  const inRegion = f.region ? muscles.filter((m) => m.region === f.region) : muscles;
  const joints = new Set<JointId>();
  const motions = new Set<string>();
  const nerves = new Set<string>();
  const roots = new Set<string>();
  for (const m of inRegion) {
    for (const a of m.actions) {
      joints.add(a.joint);
      if (a.joint === f.joint) motions.add(a.motion);
    }
    for (const n of m.innervation) {
      nerves.add(baseNerve(n.nerve));
      n.roots.flatMap(expandRoot).forEach((r) => roots.add(r));
    }
  }
  return {
    joints,
    motions: [...motions].sort(),
    nerves: [...nerves].sort(),
    roots: [...roots].sort((a, b) => rootRank(a) - rootRank(b)),
  };
}
