import { lazy, Suspense, useMemo, useState } from 'react';
import { MUSCLES, MUSCLE_BY_ID } from './data';
import { applyFilters, EMPTY_FILTERS, type Filters } from './lib/search';
import { useSelectedId } from './lib/useHashRoute';
import { Sidebar } from './components/Sidebar';
import { MuscleDetail } from './components/MuscleDetail';
import { Welcome } from './components/Welcome';

// three.js는 무거우므로 별도 청크로 분리해 목록/상세 화면이 먼저 뜨게 함
const Viewer3D = lazy(() => import('./components/Viewer3D').then((m) => ({ default: m.Viewer3D })));

function isActive(f: Filters): boolean {
  return Boolean(f.query.trim() || f.joint || f.nerve || f.root);
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, select] = useSelectedId();
  const [show3D, setShow3D] = useState(true);
  const results = useMemo(() => applyFilters(MUSCLES, filters), [filters]);
  const selected = selectedId ? MUSCLE_BY_ID.get(selectedId) ?? null : null;
  // 검색/필터가 걸려 있으면 3D에서 해당 근육만 강조
  const highlightIds = useMemo(
    () => (isActive(filters) ? new Set(results.map((m) => m.id)) : null),
    [filters, results],
  );

  /** 상세 화면에서 신경/동작 등을 눌렀을 때 해당 조건으로 목록을 필터링 */
  const filterBy = (patch: Partial<Filters>) =>
    setFilters({ ...EMPTY_FILTERS, ...patch });

  return (
    <div className={`app${show3D ? ' with-3d' : ''}`}>
      <Sidebar
        filters={filters}
        onFilters={setFilters}
        results={results}
        selectedId={selectedId}
        onSelect={select}
        show3D={show3D}
        onToggle3D={() => setShow3D((v) => !v)}
      />
      {show3D && (
        <section className="stage">
          <Suspense fallback={<div className="viewer-msg">3D 뷰어 준비 중…</div>}>
            <Viewer3D selectedId={selectedId} highlightIds={highlightIds} onSelect={select} />
          </Suspense>
        </section>
      )}
      <main className="main">
        {selected ? (
          <MuscleDetail key={selected.id} muscle={selected} onSelect={select} onFilter={filterBy} />
        ) : (
          <Welcome onFilter={filterBy} />
        )}
      </main>
    </div>
  );
}
