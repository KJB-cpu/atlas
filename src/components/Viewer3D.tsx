import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnatomyViewer, type DisplayState, type Part, type PartAction, type View } from '../three/AnatomyViewer';
import { MUSCLE_BY_ID } from '../data';

interface Props {
  selectedId: string | null;
  highlightIds: Set<string> | null;
  onSelect: (id: string | null) => void;
}

const MODEL_EXT = import.meta.env.VITE_TARGET === 'artifact' ? 'glb.json' : 'glb';
const modelUrl = (name: string) => `${import.meta.env.BASE_URL}models/${name}.${MODEL_EXT}`;
const MODELS = {
  headneck: modelUrl('headneck'),
  upper: modelUrl('upper'),
  trunk: modelUrl('trunk'),
  lower: modelUrl('lower'),
};

const REGION_BUTTONS: { id: keyof typeof MODELS | null; label: string; title: string }[] = [
  { id: 'headneck', label: 'H&N', title: 'Head & Neck 보기' },
  { id: 'upper', label: 'UE', title: 'Upper extremity 보기' },
  { id: 'trunk', label: 'Trunk', title: 'Spine & Trunk 보기' },
  { id: 'lower', label: 'LE', title: 'Lower extremity 보기' },
  { id: null, label: '⤢', title: '전체 보기' },
];

type Toggles = Omit<DisplayState, 'selectedId' | 'highlightIds' | 'hidden' | 'faded'>;

const DEFAULT_TOGGLES: Toggles = {
  showBones: true,
  showMuscles: true,
  showConnective: true,
  xray: false,
  isolate: false,
  focus: true,
};

// 레이어/모드 설정과 숨김·흐림 목록은 이 브라우저에 기억 (새로고침해도 해부 진행 상태 유지)
const STORE_KEY = 'atlas.viewer.v1';
interface Stored {
  toggles: Toggles;
  hidden: string[];
  faded: string[];
}

function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>;
      return {
        toggles: { ...DEFAULT_TOGGLES, ...v.toggles },
        hidden: Array.isArray(v.hidden) ? v.hidden : [],
        faded: Array.isArray(v.faded) ? v.faded : [],
      };
    }
  } catch {
    // 저장소를 쓸 수 없는 환경 — 기본값으로 동작
  }
  return { toggles: DEFAULT_TOGGLES, hidden: [], faded: [] };
}

function saveStored(v: Stored): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    // 무시
  }
}

/** 'muscles:gluteus-maximus' → 'Gluteus maximus', 'bones:Scapula' → 'Scapula' */
function keyLabel(key: string): string {
  const i = key.indexOf(':');
  const kind = key.slice(0, i);
  const name = key.slice(i + 1);
  return kind === 'muscles' ? MUSCLE_BY_ID.get(name)?.name ?? name : name;
}

const VIEWS: { id: View; label: string }[] = [
  { id: 'anterior', label: 'Ant' },
  { id: 'posterior', label: 'Post' },
  { id: 'lateral', label: 'Lat' },
  { id: 'medial', label: 'Med' },
];

/** 누르고 있으면 계속 반복되는 버튼 (이동·확대 패드) */
function HoldButton({ onStep, label, className, children }: {
  onStep: () => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const timer = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = undefined;
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onStep();
        stop();
        timer.current = window.setInterval(onStep, 60);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStep();
        }
      }}
    >
      {children}
    </button>
  );
}

function partLabel(p: Part): string {
  return p.kind === 'muscles' ? MUSCLE_BY_ID.get(p.name)?.name ?? p.name : p.name;
}

export function Viewer3D({ selectedId, highlightIds, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hover, setHover] = useState<{ label: string; kind: string; x: number; y: number } | null>(null);
  const [initial] = useState(loadStored);
  const [toggles, setToggles] = useState<Toggles>(initial.toggles);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(initial.hidden));
  const [faded, setFaded] = useState<Set<string>>(() => new Set(initial.faded));
  const [listOpen, setListOpen] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /** 같은 동작을 다시 하면 원래대로. hide ↔ fade는 서로 전환 */
  const applyAction = (key: string, action: PartAction) => {
    const [target, other, setTarget, setOther] =
      action === 'hide' ? [hidden, faded, setHidden, setFaded] : [faded, hidden, setFaded, setHidden];
    const nextTarget = new Set(target);
    if (nextTarget.has(key)) nextTarget.delete(key);
    else {
      nextTarget.add(key);
      if (other.has(key)) {
        const nextOther = new Set(other);
        nextOther.delete(key);
        setOther(nextOther);
      }
    }
    setTarget(nextTarget);
  };
  const restore = (key: string) => {
    setHidden((h) => {
      const n = new Set(h);
      n.delete(key);
      return n;
    });
    setFaded((f) => {
      const n = new Set(f);
      n.delete(key);
      return n;
    });
  };
  const restoreAll = () => {
    setHidden(new Set());
    setFaded(new Set());
    setListOpen(false);
  };
  const actionRef = useRef(applyAction);
  actionRef.current = applyAction;

  useEffect(() => {
    const v = new AnatomyViewer(hostRef.current!);
    viewerRef.current = v;
    v.onHover = (p, x, y) => setHover(p ? { label: partLabel(p), kind: p.kind, x, y } : null);
    v.onPick = (p) => {
      if (p?.kind === 'muscles') onSelectRef.current(p.name);
    };
    v.onPartAction = (p, action) => actionRef.current(`${p.kind}:${p.name}`, action);
    v.load(MODELS).then(
      () => setStatus('ready'),
      (e) => {
        console.error(e);
        setStatus('error');
      },
    );
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.applyState({ selectedId, highlightIds, ...toggles, hidden, faded });
  }, [selectedId, highlightIds, toggles, hidden, faded, status]);

  useEffect(() => {
    saveStored({ toggles, hidden: [...hidden], faded: [...faded] });
  }, [toggles, hidden, faded]);

  // H = 선택 근육 숨기기, F = 흐리게 (입력 중일 때는 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 'h' || k === 'f') {
        e.preventDefault();
        actionRef.current(`muscles:${selectedId}`, k === 'h' ? 'hide' : 'fade');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  useEffect(() => {
    if (status === 'ready') viewerRef.current?.focus(selectedId);
  }, [selectedId, status]);

  const hasModel = selectedId ? viewerRef.current?.parts.has(`muscles:${selectedId}`) : true;
  const selKey = selectedId ? `muscles:${selectedId}` : null;
  const hiddenCount = hidden.size;
  const fadedCount = faded.size;
  const changed = [...[...hidden].map((k) => [k, 'hide'] as const), ...[...faded].map((k) => [k, 'fade'] as const)].sort(
    (a, b) => keyLabel(a[0]).localeCompare(keyLabel(b[0])),
  );
  const flip = (k: keyof Toggles) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  return (
    <div className="viewer">
      <div ref={hostRef} className="viewer-canvas" />

      <div className="viewer-bar top">
        <div className="seg" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => viewerRef.current?.setView(v.id)} title={`${v.id} view`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Region">
          {REGION_BUTTONS.map((r) => (
            <button key={r.label} onClick={() => viewerRef.current?.frameRegion(r.id)} title={r.title}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="viewer-bar bottom">
        <div className="seg" role="group" aria-label="Layers">
          <button aria-pressed={toggles.showBones} onClick={() => flip('showBones')}>Bones</button>
          <button aria-pressed={toggles.showMuscles} onClick={() => flip('showMuscles')}>Muscles</button>
          <button aria-pressed={toggles.showConnective} onClick={() => flip('showConnective')}>Tendons</button>
        </div>
        <div className="seg" role="group" aria-label="Mode">
          <button aria-pressed={toggles.xray} onClick={() => flip('xray')} title="근육 반투명">X-ray</button>
          <button aria-pressed={toggles.focus} onClick={() => flip('focus')} title="선택 시 나머지 근육 반투명">
            Focus
          </button>
          <button
            aria-pressed={toggles.isolate}
            onClick={() => flip('isolate')}
            title="선택한 근육만 보기 (뼈는 유지)"
          >
            Isolate
          </button>
        </div>
        {selKey && hasModel && status === 'ready' && (
          <div className="seg" role="group" aria-label="Selected muscle">
            <button aria-pressed={hidden.has(selKey)} onClick={() => applyAction(selKey, 'hide')} title="선택 근육 숨기기 (H)">
              Hide
            </button>
            <button aria-pressed={faded.has(selKey)} onClick={() => applyAction(selKey, 'fade')} title="선택 근육 흐리게 (F)">
              Fade
            </button>
          </div>
        )}
        {changed.length > 0 && (
          <div className="seg" role="group" aria-label="Hidden parts">
            <button aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)} title="숨김·흐림 목록">
              {[hiddenCount && `숨김 ${hiddenCount}`, fadedCount && `흐림 ${fadedCount}`].filter(Boolean).join(' · ')} ▾
            </button>
            <button onClick={restoreAll} title="모두 다시 보이기">
              모두 보이기
            </button>
          </div>
        )}
        {listOpen && changed.length > 0 && (
          <div className="viewer-panel" role="dialog" aria-label="숨김·흐림 목록">
            <ul>
              {changed.map(([key, state]) => (
                <li key={key}>
                  <span className={`state ${state}`}>{state === 'hide' ? '숨김' : '흐림'}</span>
                  <span className="name">{keyLabel(key)}</span>
                  <button className="link" onClick={() => restore(key)}>
                    보이기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>


      <div className="viewer-nav" role="group" aria-label="화면 이동·확대">
        <HoldButton className="up" label="모델 위로" onStep={() => viewerRef.current?.pan(0, 0.04)}>▲</HoldButton>
        <HoldButton className="left" label="모델 왼쪽으로" onStep={() => viewerRef.current?.pan(-0.04, 0)}>◀</HoldButton>
        <HoldButton className="right" label="모델 오른쪽으로" onStep={() => viewerRef.current?.pan(0.04, 0)}>▶</HoldButton>
        <HoldButton className="down" label="모델 아래로" onStep={() => viewerRef.current?.pan(0, -0.04)}>▼</HoldButton>
        <HoldButton className="zin" label="확대" onStep={() => viewerRef.current?.zoom(0.92)}>+</HoldButton>
        <HoldButton className="zout" label="축소" onStep={() => viewerRef.current?.zoom(1 / 0.92)}>−</HoldButton>
      </div>

      {hover && (
        <div className={`viewer-tip ${hover.kind}`} style={{ left: hover.x + 14, top: hover.y + 12 }}>
          {hover.label}
          <small>우클릭 숨기기 · Alt+클릭 흐리게 · Shift+드래그 이동</small>
        </div>
      )}
      {status === 'loading' && <div className="viewer-msg">3D 모델 불러오는 중…</div>}
      {status === 'error' && <div className="viewer-msg">3D 모델을 불러오지 못했습니다.</div>}
      {status === 'ready' && selKey && hidden.has(selKey) && (
        <div className="viewer-notice">
          선택한 근육이 숨김 상태입니다.
          <button className="link" onClick={() => restore(selKey)}>
            다시 보이기
          </button>
        </div>
      )}
      {status === 'ready' && selectedId && !hasModel && (
        <div className="viewer-msg small">이 근육은 아직 3D 모델이 없습니다.</div>
      )}
      <p className="viewer-credit">
        3D: BodyParts3D © DBCLS, CC BY-SA 2.1 JP · 오른쪽 근육 + 전신 골격
      </p>
    </div>
  );
}
