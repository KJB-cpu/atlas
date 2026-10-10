import { useEffect, useRef, useState } from 'react';
import { AnatomyViewer, type DisplayState, type Part, type View } from '../three/AnatomyViewer';
import { MUSCLE_BY_ID } from '../data';

interface Props {
  selectedId: string | null;
  highlightIds: Set<string> | null;
  onSelect: (id: string | null) => void;
}

const MODEL_EXT = import.meta.env.VITE_TARGET === 'artifact' ? 'glb.json' : 'glb';
const modelUrl = (name: string) => `${import.meta.env.BASE_URL}models/${name}.${MODEL_EXT}`;
const MODELS = {
  upper: modelUrl('upper'),
  trunk: modelUrl('trunk'),
  lower: modelUrl('lower'),
};

const REGION_BUTTONS: { id: keyof typeof MODELS | null; label: string; title: string }[] = [
  { id: 'upper', label: 'UE', title: 'Upper extremity 보기' },
  { id: 'trunk', label: 'Trunk', title: 'Spine & Trunk 보기' },
  { id: 'lower', label: 'LE', title: 'Lower extremity 보기' },
  { id: null, label: '⤢', title: '전체 보기' },
];

type Toggles = Omit<DisplayState, 'selectedId' | 'highlightIds'>;

const VIEWS: { id: View; label: string }[] = [
  { id: 'anterior', label: 'Ant' },
  { id: 'posterior', label: 'Post' },
  { id: 'lateral', label: 'Lat' },
  { id: 'medial', label: 'Med' },
];

function partLabel(p: Part): string {
  return p.kind === 'muscles' ? MUSCLE_BY_ID.get(p.name)?.name ?? p.name : p.name;
}

export function Viewer3D({ selectedId, highlightIds, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hover, setHover] = useState<{ label: string; kind: string; x: number; y: number } | null>(null);
  const [toggles, setToggles] = useState<Toggles>({
    showBones: true,
    showMuscles: true,
    showConnective: true,
    xray: false,
    isolate: false,
  });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const v = new AnatomyViewer(hostRef.current!);
    viewerRef.current = v;
    v.onHover = (p, x, y) => setHover(p ? { label: partLabel(p), kind: p.kind, x, y } : null);
    v.onPick = (p) => {
      if (p?.kind === 'muscles') onSelectRef.current(p.name);
    };
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
    viewerRef.current?.applyState({ selectedId, highlightIds, ...toggles });
  }, [selectedId, highlightIds, toggles, status]);

  useEffect(() => {
    if (status === 'ready') viewerRef.current?.focus(selectedId);
  }, [selectedId, status]);

  const hasModel = selectedId ? viewerRef.current?.parts.has(`muscles:${selectedId}`) : true;
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
          <button
            aria-pressed={toggles.isolate}
            onClick={() => flip('isolate')}
            title="선택한 근육만 보기 (뼈는 유지)"
          >
            Isolate
          </button>
        </div>
      </div>

      {hover && (
        <div className={`viewer-tip ${hover.kind}`} style={{ left: hover.x + 14, top: hover.y + 12 }}>
          {hover.label}
        </div>
      )}
      {status === 'loading' && <div className="viewer-msg">3D 모델 불러오는 중…</div>}
      {status === 'error' && <div className="viewer-msg">3D 모델을 불러오지 못했습니다.</div>}
      {status === 'ready' && selectedId && !hasModel && (
        <div className="viewer-msg small">이 근육은 아직 3D 모델이 없습니다.</div>
      )}
      <p className="viewer-credit">
        3D: BodyParts3D © DBCLS, CC BY-SA 2.1 JP · 오른쪽 상·하지, 체간
      </p>
    </div>
  );
}
