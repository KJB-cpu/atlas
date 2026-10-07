import { useEffect, useMemo, useRef } from 'react';
import type { JointId, Muscle, RegionId } from '../types';
import { MUSCLES } from '../data';
import { JOINT_LABELS, JOINT_ORDER, REGIONS } from '../data/vocab';
import { baseNerve, EMPTY_FILTERS, facetOptions, type Filters } from '../lib/search';
import { noteIds } from '../lib/notes';

interface Props {
  filters: Filters;
  onFilters: (f: Filters) => void;
  results: Muscle[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function Sidebar({ filters, onFilters, results, selectedId, onSelect }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const facets = useMemo(() => facetOptions(MUSCLES, filters), [filters]);
  const withNotes = useMemo(() => noteIds(), [selectedId]);
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });
  const active =
    filters.query || filters.region || filters.joint || filters.nerve || filters.root;

  // '/' 검색 포커스, ↑/↓ 목록 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, select');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!typing || e.target === searchRef.current)) {
        if (!results.length) return;
        e.preventDefault();
        const i = results.findIndex((m) => m.id === selectedId);
        const next =
          e.key === 'ArrowDown'
            ? Math.min(results.length - 1, i + 1)
            : Math.max(0, i === -1 ? 0 : i - 1);
        onSelect(results[next].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, selectedId, onSelect]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  // 검색어가 없을 때는 group 단위로 묶어서 보여줌
  const grouped = useMemo(() => {
    if (filters.query) return [{ group: null as string | null, items: results }];
    const map = new Map<string, Muscle[]>();
    for (const m of results) {
      const arr = map.get(m.group) ?? [];
      arr.push(m);
      map.set(m.group, arr);
    }
    return [...map].map(([group, items]) => ({ group: group as string | null, items }));
  }, [results, filters.query]);

  return (
    <aside className="sidebar">
      <header className="brand">
        <button className="brand-mark" onClick={() => onSelect(null)} title="처음 화면">
          Atlas
        </button>
        <span className="brand-sub">{MUSCLES.length} muscles</span>
      </header>

      <div className="search">
        <input
          ref={searchRef}
          type="search"
          placeholder="근육, 신경, 부착부 검색  ( / )"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') set({ query: '' });
            if (e.key === 'Enter' && results[0]) onSelect(results[0].id);
          }}
        />
      </div>

      <div className="filters">
        <div className="chips" role="group" aria-label="Region">
          {REGIONS.map((r) => {
            const count = MUSCLES.filter((m) => m.region === r.id).length;
            return (
              <button
                key={r.id}
                className="chip"
                aria-pressed={filters.region === r.id}
                disabled={count === 0}
                title={count === 0 ? '데이터 준비 중' : undefined}
                onClick={() =>
                  set({ region: filters.region === r.id ? null : (r.id as RegionId) })
                }
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="filter-row">
          <label>
            <span>Joint</span>
            <select
              value={filters.joint ?? ''}
              onChange={(e) =>
                set({ joint: (e.target.value || null) as JointId | null, motion: null })
              }
            >
              <option value="">전체</option>
              {JOINT_ORDER.filter((j) => facets.joints.has(j)).map((j) => (
                <option key={j} value={j}>
                  {JOINT_LABELS[j]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Motion</span>
            <select
              value={filters.motion ?? ''}
              disabled={!filters.joint}
              onChange={(e) => set({ motion: e.target.value || null })}
            >
              <option value="">{filters.joint ? '전체' : 'Joint 먼저 선택'}</option>
              {facets.motions.map((mo) => (
                <option key={mo} value={mo}>
                  {mo}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-row">
          <label>
            <span>Nerve</span>
            <select value={filters.nerve ?? ''} onChange={(e) => set({ nerve: e.target.value || null })}>
              <option value="">전체</option>
              {facets.nerves.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Root</span>
            <select value={filters.root ?? ''} onChange={(e) => set({ root: e.target.value || null })}>
              <option value="">전체</option>
              {facets.roots.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="result-bar">
          <span>
            {results.length}개{active ? ' 검색됨' : ''}
          </span>
          {active && (
            <button className="link" onClick={() => onFilters(EMPTY_FILTERS)}>
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="list" ref={listRef}>
        {results.length === 0 && <p className="empty">조건에 맞는 근육이 없습니다.</p>}
        {grouped.map(({ group, items }) => (
          <section key={group ?? 'all'}>
            {group && <h3 className="list-group">{group}</h3>}
            {items.map((m) => (
              <button
                key={m.id}
                className="list-item"
                aria-current={m.id === selectedId}
                onClick={() => onSelect(m.id)}
              >
                <span className="list-name">
                  {m.name}
                  {withNotes.has(m.id) && <span className="note-dot" title="메모 있음" />}
                </span>
                <span className="list-meta">
                  {baseNerve(m.innervation[0].nerve)} ·{' '}
                  {[...new Set(m.innervation.flatMap((n) => n.roots))].join(', ')}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
