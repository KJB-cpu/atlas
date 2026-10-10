import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export type PartKind = 'muscles' | 'bones' | 'connective';
export type View = 'anterior' | 'posterior' | 'lateral' | 'medial';

export interface Part {
  kind: PartKind;
  /** muscles: src/data의 muscle id, bones/connective: 표시 이름 */
  name: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  baseColor: THREE.Color;
  center: THREE.Vector3;
  radius: number;
}

export interface DisplayState {
  selectedId: string | null;
  /** 필터 결과. null이면 필터 없음 */
  highlightIds: Set<string> | null;
  showBones: boolean;
  showMuscles: boolean;
  showConnective: boolean;
  xray: boolean;
  isolate: boolean;
  /** 선택 시 나머지 근육을 반투명하게 (deep muscle이 가려지지 않게) */
  focus: boolean;
  /** 사용자가 숨긴/흐리게 한 파트. key = `${kind}:${name}` */
  hidden: Set<string>;
  faded: Set<string>;
}

export type PartAction = 'hide' | 'fade';

const MUSCLE = new THREE.Color('#b9543e');
const BONE = new THREE.Color('#e8dfcc');
const CONNECTIVE = new THREE.Color('#d9d4c4');
const SELECT = new THREE.Color('#f2a33a');
const HOVER_EMISSIVE = new THREE.Color('#3a2a10');

/** 근육마다 약간씩 다른 색을 줘서 인접 근육 경계가 보이게 */
function muscleTint(name: string): THREE.Color {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = MUSCLE.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + ((h % 7) - 3) * 0.006, hsl.s + ((h >> 3) % 5 - 2) * 0.03, hsl.l + ((h >> 6) % 7 - 3) * 0.022);
  return c;
}

/**
 * BodyParts3D 좌표계 (glTF 변환 후, Y-up):
 *   +X = patient's left, +Z = anterior (변환 스크립트에서 Z-up → Y-up 회전)
 * 오른쪽 하지 모델이므로 lateral = -X 방향.
 */
const VIEW_DIR: Record<View, THREE.Vector3> = {
  anterior: new THREE.Vector3(0, 0, 1),
  posterior: new THREE.Vector3(0, 0, -1),
  lateral: new THREE.Vector3(-1, 0, 0),
  medial: new THREE.Vector3(1, 0, 0),
};

/** '.glb.json'({ glb: base64 })이면 풀어서 parse, 아니면 일반 GLB 로드 */
async function loadModel(loader: GLTFLoader, url: string) {
  if (!url.endsWith('.json')) return loader.loadAsync(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const { glb } = (await res.json()) as { glb: string };
  const bin = atob(glb);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return loader.parseAsync(bytes.buffer, '');
}

export class AnatomyViewer {
  readonly parts = new Map<string, Part>();
  onHover: (part: Part | null, x: number, y: number) => void = () => {};
  onPick: (part: Part | null) => void = () => {};
  /** 3D에서 우클릭 = hide, Alt(Option)+클릭 = fade */
  onPartAction: (part: Part, action: PartAction) => void = () => {};

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: Part | null = null;
  private state: DisplayState | null = null;
  private frame = 0;
  private anim: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t0: number } | null = null;
  private resizeObs: ResizeObserver;
  private modelCenter = new THREE.Vector3();
  private modelSize = new THREE.Vector3(1, 1, 1);
  private modelBox = new THREE.Box3();
  private regions = new Map<string, THREE.Box3>();
  private disposed = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    // 클릭하면 포커스를 받아 방향키(이동)·+/−(확대) 사용 가능
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', '3D 해부 모델 — 드래그 회전, Shift+드래그 이동, 방향키 이동, +/− 확대');

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#5a5048', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(-1.5, 2, -2);
    this.camera.add(key);
    const fill = new THREE.DirectionalLight('#ffffff', 0.6);
    fill.position.set(2, -1, 1);
    this.camera.add(fill);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener('change', () => this.requestRender());

    const el = this.renderer.domElement;
    let down: { x: number; y: number; button: number } | null = null;
    el.addEventListener('pointermove', (e) => this.handleMove(e));
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.15 : 0.06;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      // 화살표 방향으로 모델이 움직임 (드래그와 같은 감각)
      if (moves[e.key]) this.pan(...moves[e.key]);
      else if (e.key === '+' || e.key === '=') this.zoom(0.85);
      else if (e.key === '-' || e.key === '_') this.zoom(1 / 0.85);
      else return;
      e.preventDefault();
    });
    el.addEventListener('pointerleave', () => this.setHovered(null, 0, 0));
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, button: e.button }));
    el.addEventListener('pointerup', (e) => {
      // 드래그(회전/이동)와 클릭 구분
      if (down && down.button === e.button && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const part = this.pick(e);
        if (e.button === 2) {
          if (part) this.onPartAction(part, 'hide');
        } else if (e.button === 0) {
          if (e.altKey) {
            if (part) this.onPartAction(part, 'fade');
          } else this.onPick(part);
        }
      }
      down = null;
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  /** 여러 부위 모델(같은 BodyParts3D 좌표계)을 한 장면에 불러옴. key = region 이름 */
  async load(models: Record<string, string>): Promise<void> {
    const loader = new GLTFLoader();
    // 로컬 빌드는 meshopt 압축 모델(작음)을 쓰고, 온라인(Artifact) 빌드는 WebAssembly가
    // 필요 없는 양자화 모델을 씀 — 이 경우 디코더 코드가 번들에서 빠짐
    if (import.meta.env.VITE_TARGET !== 'artifact') {
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    const loaded = await Promise.all(
      Object.entries(models).map(async ([region, url]) => [region, await loadModel(loader, url)] as const),
    );
    if (this.disposed) return;
    for (const [region, gltf] of loaded) {
      const box = this.addModel(gltf.scene);
      this.regions.set(region, box);
      this.modelBox.union(box);
    }

    this.modelBox.getCenter(this.modelCenter);
    this.modelBox.getSize(this.modelSize);
    this.controls.target.copy(this.modelCenter);
    this.camera.position.copy(this.modelCenter).addScaledVector(VIEW_DIR.anterior, this.distanceForSize(this.modelSize));
    const r = this.modelSize.length() / 2;
    this.controls.minDistance = r * 0.06;
    this.controls.maxDistance = r * 5;
    if (this.state) this.applyState(this.state);
    this.requestRender();
  }

  private addModel(root: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const [kind, name] = obj.name.split('__') as [PartKind, string];
      if (!name) return;
      const geom = obj.geometry as THREE.BufferGeometry;
      if (!geom.attributes.normal) geom.computeVertexNormals();
      geom.computeBoundsTree();
      geom.computeBoundingSphere();
      const baseColor = kind === 'muscles' ? muscleTint(name) : kind === 'bones' ? BONE.clone() : CONNECTIVE.clone();
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: kind === 'bones' ? 0.75 : 0.55,
        metalness: 0,
      });
      obj.material = mat;
      obj.updateWorldMatrix(true, false);
      const sphere = geom.boundingSphere!.clone().applyMatrix4(obj.matrixWorld);
      this.parts.set(`${kind}:${name}`, {
        kind,
        name,
        mesh: obj as Part['mesh'],
        baseColor,
        center: sphere.center,
        radius: sphere.radius,
      });
      box.expandByObject(obj);
    });
    this.scene.add(root);
    return box;
  }

  applyState(s: DisplayState): void {
    this.state = s;
    // 선택한 근육을 숨기면 focus/isolate 효과도 해제 → 바깥 근육을 하나씩 걷어내는 흐름
    const sel = s.selectedId && !s.hidden.has(`muscles:${s.selectedId}`) ? s.selectedId : null;
    const dimOthers = (sel && (s.focus || s.isolate)) || s.highlightIds;
    for (const p of this.parts.values()) {
      const m = p.mesh.material;
      const key = `${p.kind}:${p.name}`;
      let visible = true;
      let opacity = 1;
      let color = p.baseColor;
      if (p.kind === 'bones') visible = s.showBones;
      else if (p.kind === 'connective') {
        visible = s.showConnective;
        if (dimOthers || s.xray) opacity = 0.25;
      } else {
        const selected = p.name === sel;
        visible = s.showMuscles || selected;
        if (selected) color = SELECT;
        else if (s.isolate && sel) opacity = 0.06;
        else if (s.highlightIds && !s.highlightIds.has(p.name)) opacity = 0.07;
        else if (s.xray) opacity = 0.3;
        // 선택 시 나머지 근육을 반투명하게 → deep muscle도 가려지지 않음
        else if (s.focus && sel) opacity = 0.22;
      }
      if (s.hidden.has(key)) visible = false;
      // 흐리게 한 파트는 클릭이 통과하도록 pick 기준(0.2)보다 낮게. 선택된 근육은 위치가 보이도록 조금 진하게
      if (s.faded.has(key)) opacity = Math.min(opacity, p.name === sel ? 0.4 : 0.12);
      p.mesh.visible = visible;
      m.color.copy(color);
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.depthWrite = opacity === 1;
      // 투명 메시는 불투명 메시 뒤에 그려야 깨지지 않음
      p.mesh.renderOrder = opacity < 1 ? 1 : 0;
      m.needsUpdate = true;
    }
    this.updateHoverLook();
    this.requestRender();
  }

  /** 선택한 근육 쪽으로 카메라 이동 */
  focus(muscleId: string | null): void {
    const part = muscleId ? this.parts.get(`muscles:${muscleId}`) : null;
    const target = part ? part.center : this.modelCenter;
    const dist = part
      ? Math.max(this.fitDistance(part.radius) * 1.7, this.controls.minDistance * 1.2)
      : this.distanceForSize(this.modelSize);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.animateTo(target, target.clone().addScaledVector(dir, dist));
  }

  /**
   * 화면 기준 평행 이동(pan). dx·dy는 현재 보이는 화면 높이에 대한 비율.
   * 모델이 (+dx = 오른쪽, +dy = 위)로 움직여 보이도록 카메라와 회전 중심을 반대로 옮김
   * — Shift+드래그 방향과 같음.
   */
  pan(dx: number, dy: number): void {
    this.anim = null;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const viewH = 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    const offset = right.multiplyScalar(-dx * viewH).addScaledVector(up, -dy * viewH);
    this.camera.position.add(offset);
    this.controls.target.add(offset);
    this.requestRender();
  }

  /** factor < 1 이면 확대(가까이), > 1 이면 축소 */
  zoom(factor: number): void {
    this.anim = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).addScaledVector(offset.normalize(), len);
    this.requestRender();
  }

  setView(view: View): void {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const t = this.controls.target.clone();
    this.animateTo(t, t.clone().addScaledVector(VIEW_DIR[view], dist));
  }

  /** 부위(region) 전체가 보이도록 anterior view로 이동. null이면 전체 */
  frameRegion(region: string | null): void {
    const box = region ? this.regions.get(region) : this.modelBox;
    if (!box || box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.animateTo(c, c.clone().addScaledVector(VIEW_DIR.anterior, this.distanceForSize(size)));
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    this.controls.dispose();
    for (const p of this.parts.values()) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ───────────────────────── internals ─────────────────────────

  private fitDistance(radius: number): number {
    const fov = (this.camera.fov * Math.PI) / 180;
    const fovMin = this.camera.aspect < 1 ? 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect) : fov;
    return (radius / Math.sin(fovMin / 2)) * 1.02;
  }

  /** 주어진 크기의 박스가 화면 높이/너비에 들어오는 카메라 거리 (anterior view 기준) */
  private distanceForSize(size: THREE.Vector3): number {
    const half = Math.max(size.y / 2, size.x / 2 / this.camera.aspect);
    const fov = (this.camera.fov * Math.PI) / 180;
    return (half / Math.tan(fov / 2)) * 1.1 + size.z / 2;
  }

  private animateTo(target: THREE.Vector3, cam: THREE.Vector3): void {
    this.anim = {
      from: this.controls.target.clone(),
      to: target.clone(),
      camFrom: this.camera.position.clone(),
      camTo: cam,
      t0: performance.now(),
    };
    this.requestRender();
  }

  private pick(e: PointerEvent): Part | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.firstHitOnly = true;
    const candidates: THREE.Object3D[] = [];
    for (const p of this.parts.values()) {
      // 거의 투명한 근육은 클릭 대상에서 제외 → 뒤에 있는 구조물 선택 가능
      if (p.mesh.visible && p.mesh.material.opacity > 0.2) candidates.push(p.mesh);
    }
    const hit = this.raycaster.intersectObjects(candidates, false)[0];
    if (!hit) return null;
    for (const p of this.parts.values()) if (p.mesh === hit.object) return p;
    return null;
  }

  private handleMove(e: PointerEvent): void {
    if (e.buttons) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.setHovered(this.pick(e), e.clientX - rect.left, e.clientY - rect.top);
  }

  private setHovered(part: Part | null, x: number, y: number): void {
    const changed = part !== this.hovered;
    this.hovered = part;
    this.renderer.domElement.style.cursor = part?.kind === 'muscles' ? 'pointer' : '';
    this.onHover(part, x, y);
    if (changed) {
      this.updateHoverLook();
      this.requestRender();
    }
  }

  private updateHoverLook(): void {
    for (const p of this.parts.values()) {
      p.mesh.material.emissive.copy(p === this.hovered && p.kind === 'muscles' ? HOVER_EMISSIVE : new THREE.Color(0));
    }
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.tick();
    });
  }

  private tick(): void {
    let moving = false;
    if (this.anim) {
      const t = Math.min(1, (performance.now() - this.anim.t0) / 450);
      const k = 1 - Math.pow(1 - t, 3);
      this.controls.target.lerpVectors(this.anim.from, this.anim.to, k);
      this.camera.position.lerpVectors(this.anim.camFrom, this.anim.camTo, k);
      if (t >= 1) this.anim = null;
      moving = true;
    }
    // damping이 끝날 때까지 update가 change 이벤트를 발생시켜 다음 프레임을 요청함
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (moving) this.requestRender();
  }
}
