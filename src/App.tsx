import { useMemo, useState } from 'react';
import { MUSCLES, MUSCLE_BY_ID } from './data';
import { applyFilters, EMPTY_FILTERS, type Filters } from './lib/search';
import { useSelectedId } from './lib/useHashRoute';
import { Sidebar } from './components/Sidebar';
import { MuscleDetail } from './components/MuscleDetail';
import { Welcome } from './components/Welcome';

export default function App() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, select] = useSelectedId();
  const results = useMemo(() => applyFilters(MUSCLES, filters), [filters]);
  const selected = selectedId ? MUSCLE_BY_ID.get(selectedId) ?? null : null;

  /** 상세 화면에서 신경/동작 등을 눌렀을 때 해당 조건으로 목록을 필터링 */
  const filterBy = (patch: Partial<Filters>) =>
    setFilters({ ...EMPTY_FILTERS, ...patch });

  return (
    <div className="app">
      <Sidebar
        filters={filters}
        onFilters={setFilters}
        results={results}
        selectedId={selectedId}
        onSelect={select}
      />
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
