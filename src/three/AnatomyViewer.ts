import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
}

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

export class AnatomyViewer {
  readonly parts = new Map<string, Part>();
  onHover: (part: Part | null, x: number, y: number) => void = () => {};
  onPick: (part: Part | null) => void = () => {};

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
  private disposed = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

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
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointermove', (e) => this.handleMove(e));
    el.addEventListener('pointerleave', () => this.setHovered(null, 0, 0));
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      // 드래그(회전)와 클릭 구분
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        this.onPick(this.pick(e));
      }
      down = null;
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    if (this.disposed) return;

    const box = new THREE.Box3();
    gltf.scene.traverse((obj) => {
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
    this.scene.add(gltf.scene);

    box.getCenter(this.modelCenter);
    box.getSize(this.modelSize);
    this.controls.target.copy(this.modelCenter);
    this.camera.position.copy(this.modelCenter).addScaledVector(VIEW_DIR.anterior, this.modelDistance());
    const r = this.modelSize.length() / 2;
    this.controls.minDistance = r * 0.12;
    this.controls.maxDistance = r * 6;
    if (this.state) this.applyState(this.state);
    this.requestRender();
  }

  muscleIds(): Set<string> {
    const s = new Set<string>();
    for (const p of this.parts.values()) if (p.kind === 'muscles') s.add(p.name);
    return s;
  }

  applyState(s: DisplayState): void {
    this.state = s;
    const dimOthers = s.selectedId || s.highlightIds;
    for (const p of this.parts.values()) {
      const m = p.mesh.material;
      let visible = true;
      let opacity = 1;
      let color = p.baseColor;
      if (p.kind === 'bones') visible = s.showBones;
      else if (p.kind === 'connective') {
        visible = s.showConnective;
        if (dimOthers || s.xray) opacity = 0.25;
      } else {
        const selected = p.name === s.selectedId;
        visible = s.showMuscles || selected;
        if (selected) color = SELECT;
        else if (s.isolate && s.selectedId) opacity = 0.06;
        else if (s.highlightIds && !s.highlightIds.has(p.name)) opacity = 0.07;
        // 선택 시 나머지 근육을 반투명하게 → deep muscle도 가려지지 않음
        else if (s.xray || s.selectedId) opacity = s.xray ? 0.3 : 0.22;
      }
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
    const dist = part ? Math.max(this.fitDistance(part.radius) * 1.7, this.controls.minDistance * 1.2) : this.modelDistance();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.animateTo(target, target.clone().addScaledVector(dir, dist));
  }

  setView(view: View): void {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const t = this.controls.target.clone();
    this.animateTo(t, t.clone().addScaledVector(VIEW_DIR[view], dist));
  }

  resetView(): void {
    const c = this.modelCenter.clone();
    this.animateTo(c, c.clone().addScaledVector(VIEW_DIR.anterior, this.modelDistance()));
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

  /** 모델 전체가 화면 높이/너비에 들어오는 거리 (세로로 긴 하지 모델 기준) */
  private modelDistance(): number {
    const half = Math.max(this.modelSize.y / 2, Math.max(this.modelSize.x, this.modelSize.z) / 2 / this.camera.aspect);
    const fov = (this.camera.fov * Math.PI) / 180;
    return (half / Math.tan(fov / 2)) * 1.12 + Math.max(this.modelSize.x, this.modelSize.z) / 2;
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
