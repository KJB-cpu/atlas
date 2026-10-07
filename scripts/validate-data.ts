// 데이터 무결성 검사: id 중복, 깨진 synergist/antagonist 참조, 빈 필수 필드.
import { MUSCLES, MUSCLE_BY_ID } from '../src/data';

let errors = 0;
const err = (msg: string) => {
  errors++;
  console.error('✗', msg);
};

const seen = new Set<string>();
for (const m of MUSCLES) {
  if (seen.has(m.id)) err(`duplicate id: ${m.id}`);
  seen.add(m.id);
  if (!/^[a-z0-9-]+$/.test(m.id)) err(`${m.id}: id must be kebab-case`);
  for (const k of ['origin', 'insertion', 'actions', 'innervation', 'bloodSupply'] as const) {
    if (!m[k].length) err(`${m.id}: empty ${k}`);
  }
  for (const n of m.innervation) if (!n.roots.length) err(`${m.id}: ${n.nerve} has no roots`);
  for (const ref of [...(m.synergists ?? []), ...(m.antagonists ?? [])]) {
    if (!MUSCLE_BY_ID.has(ref)) err(`${m.id}: unknown muscle reference "${ref}"`);
    if (ref === m.id) err(`${m.id}: references itself`);
  }
}

console.log(`${MUSCLES.length} muscles checked, ${errors} error(s)`);
process.exit(errors ? 1 : 0);
