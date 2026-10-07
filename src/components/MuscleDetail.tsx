import type { ReactNode } from 'react';
import type { Muscle } from '../types';
import { MUSCLE_BY_ID } from '../data';
import { JOINT_LABELS, REGIONS } from '../data/vocab';
import { baseNerve, type Filters } from '../lib/search';
import { NotesBox } from './NotesBox';

interface Props {
  muscle: Muscle;
  onSelect: (id: string) => void;
  onFilter: (patch: Partial<Filters>) => void;
}

function Section({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`card${wide ? ' wide' : ''}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function MuscleLinks({ ids, onSelect }: { ids: string[]; onSelect: (id: string) => void }) {
  return (
    <div className="link-list">
      {ids.map((id) => {
        const m = MUSCLE_BY_ID.get(id);
        return m ? (
          <button key={id} className="pill" onClick={() => onSelect(id)}>
            {m.name}
          </button>
        ) : (
          <span key={id} className="pill muted">
            {id}
          </span>
        );
      })}
    </div>
  );
}

export function MuscleDetail({ muscle: m, onSelect, onFilter }: Props) {
  const region = REGIONS.find((r) => r.id === m.region)?.label;
  const c = m.clinical;

  return (
    <article className="detail">
      <header className="detail-head">
        <p className="crumbs">
          <button className="link" onClick={() => onFilter({ region: m.region })}>
            {region}
          </button>
          <span aria-hidden> / </span>
          {m.group}
        </p>
        <h1>{m.name}</h1>
        {m.aliases && <p className="aliases">{m.aliases.join(' · ')}</p>}
      </header>

      <div className="grid">
        <Section title="Origin">
          <ul>{m.origin.map((o) => <li key={o}>{o}</li>)}</ul>
        </Section>
        <Section title="Insertion">
          <ul>{m.insertion.map((o) => <li key={o}>{o}</li>)}</ul>
        </Section>

        <Section title="Action" wide>
          <table className="actions">
            <tbody>
              {m.actions.map((a, i) => (
                <tr key={i} className={a.accessory ? 'accessory' : undefined}>
                  <td className="joint">{JOINT_LABELS[a.joint]}</td>
                  <td>
                    <button
                      className="link motion"
                      title="이 동작을 하는 근육 보기"
                      onClick={() => onFilter({ joint: a.joint, motion: a.motion })}
                    >
                      {a.motion}
                    </button>
                    {a.accessory && <span className="tag">assist</span>}
                  </td>
                  <td className="note">{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Innervation">
          {m.innervation.map((n) => (
            <div key={n.nerve + n.note} className="nerve">
              <button
                className="link"
                title="이 신경이 지배하는 근육 보기"
                onClick={() => onFilter({ nerve: baseNerve(n.nerve) })}
              >
                {n.nerve}
              </button>
              <span className="roots">
                {n.roots.map((r) => (
                  <button key={r} className="root" title={`${r} 근육 보기`} onClick={() => onFilter({ root: r })}>
                    {r}
                  </button>
                ))}
              </span>
              {n.note && <span className="note">{n.note}</span>}
            </div>
          ))}
        </Section>
        <Section title="Blood supply">
          <ul>{m.bloodSupply.map((b) => <li key={b}>{b}</li>)}</ul>
        </Section>

        {(m.synergists?.length || m.antagonists?.length) && (
          <Section title="Synergists / Antagonists" wide>
            <div className="pair">
              {m.synergists?.length ? (
                <div>
                  <h3>Synergists</h3>
                  <MuscleLinks ids={m.synergists} onSelect={onSelect} />
                </div>
              ) : null}
              {m.antagonists?.length ? (
                <div>
                  <h3>Antagonists</h3>
                  <MuscleLinks ids={m.antagonists} onSelect={onSelect} />
                </div>
              ) : null}
            </div>
          </Section>
        )}
      </div>

      {c && (
        <>
          <h2 className="part-title">Clinical (PT)</h2>
          <div className="grid">
            {c.palpation && (
              <Section title="Palpation" wide>
                <p>{c.palpation}</p>
              </Section>
            )}
            {c.mmt && (
              <Section title="MMT" wide>
                <dl className="mmt">
                  <dt>Position</dt>
                  <dd>{c.mmt.position}</dd>
                  {c.mmt.stabilization && (
                    <>
                      <dt>Stabilization</dt>
                      <dd>{c.mmt.stabilization}</dd>
                    </>
                  )}
                  <dt>Resistance</dt>
                  <dd>{c.mmt.resistance}</dd>
                  {c.mmt.substitution && (
                    <>
                      <dt>Substitution</dt>
                      <dd>{c.mmt.substitution}</dd>
                    </>
                  )}
                </dl>
              </Section>
            )}
            {c.tests?.length ? (
              <Section title="Tests" wide>
                <div className="tests">
                  {c.tests.map((t) => (
                    <div key={t.name} className="test">
                      <strong>{t.name}</strong>
                      <p>{t.note}</p>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
            {c.dysfunction?.length ? (
              <Section title="Dysfunction & movement impairment" wide>
                <ul>{c.dysfunction.map((d) => <li key={d}>{d}</li>)}</ul>
              </Section>
            ) : null}
            {c.notes?.length ? (
              <Section title="Notes" wide>
                <ul>{c.notes.map((d) => <li key={d}>{d}</li>)}</ul>
              </Section>
            ) : null}
          </div>
        </>
      )}

      {m.sourceNote && (
        <p className="source-note">
          <strong>출처 차이</strong> {m.sourceNote}
        </p>
      )}

      <NotesBox id={m.id} />
    </article>
  );
}
