import { MUSCLES } from '../data';
import { REGIONS } from '../data/vocab';
import type { Filters } from '../lib/search';

const QUICK: { label: string; patch: Partial<Filters> }[] = [
  { label: 'Scapular upward rotation', patch: { joint: 'scapula', motion: 'upward rotation' } },
  { label: 'Shoulder lateral rotation', patch: { joint: 'shoulder', motion: 'lateral rotation' } },
  { label: 'Forearm supination', patch: { joint: 'forearm', motion: 'supination' } },
  { label: 'Wrist extension', patch: { joint: 'wrist', motion: 'extension' } },
  { label: 'Trunk rotation', patch: { joint: 'trunk', motion: 'rotation' } },
  { label: 'Intra-abdominal pressure', patch: { joint: 'trunk', motion: 'intra-abdominal pressure' } },
  { label: 'Hip abduction', patch: { joint: 'hip', motion: 'abduction' } },
  { label: 'Knee flexion', patch: { joint: 'knee', motion: 'flexion' } },
  { label: 'Ankle dorsiflexion', patch: { joint: 'ankle', motion: 'dorsiflexion' } },
  { label: 'Radial nerve', patch: { nerve: 'Radial nerve' } },
  { label: 'Ulnar nerve', patch: { nerve: 'Ulnar nerve' } },
  { label: 'Femoral nerve', patch: { nerve: 'Femoral nerve' } },
  { label: 'Phrenic nerve', patch: { nerve: 'Phrenic nerve' } },
  { label: 'C5 root', patch: { root: 'C5' } },
  { label: 'L5 root', patch: { root: 'L5' } },
];

export function Welcome({ onFilter }: { onFilter: (patch: Partial<Filters>) => void }) {
  return (
    <div className="welcome">
      <h1>Atlas</h1>
      <p className="lede">개인용 근골격 해부학 노트. 왼쪽에서 근육을 고르거나, 아래 조건으로 바로 찾아보세요.</p>

      <h2>빠른 탐색</h2>
      <div className="link-list">
        {QUICK.map((q) => (
          <button key={q.label} className="pill" onClick={() => onFilter(q.patch)}>
            {q.label}
          </button>
        ))}
      </div>

      <h2>데이터 현황</h2>
      <ul className="stats">
        {REGIONS.map((r) => {
          const n = MUSCLES.filter((m) => m.region === r.id).length;
          return (
            <li key={r.id}>
              <span>{r.label}</span>
              <strong>{n ? `${n}` : '준비 중'}</strong>
            </li>
          );
        })}
      </ul>

      <h2>단축키</h2>
      <ul className="keys">
        <li><kbd>/</kbd> 검색</li>
        <li><kbd>↑</kbd> <kbd>↓</kbd> 목록 이동</li>
        <li><kbd>Enter</kbd> 첫 결과 열기</li>
        <li><kbd>Esc</kbd> 검색어 지우기</li>
      </ul>
    </div>
  );
}
