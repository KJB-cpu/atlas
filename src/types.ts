// 근육 데이터 스키마.
// 해부학 용어는 영어, 임상 설명(clinical.*)은 한국어 + 영어 용어 혼용.

export type RegionId = 'lower' | 'upper' | 'trunk' | 'headNeck';

export type JointId =
  // Lower extremity
  | 'pelvis'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'foot'
  | 'hallux'
  | 'toes'
  // Upper extremity
  | 'scapula'
  | 'shoulder'
  | 'elbow'
  | 'forearm'
  | 'wrist'
  | 'fingers'
  | 'thumb'
  // Spine & trunk / head & neck
  | 'cervical'
  | 'trunk'
  | 'ribs'
  | 'tmj'
  | 'head'
  | 'hyoid'
  | 'face';

export interface Action {
  joint: JointId;
  /** 표준 동작 어휘. 예: 'flexion', 'abduction', 'lateral rotation', 'dorsiflexion' */
  motion: string;
  /** 'upper fibers', 'when hip flexed >60°' 등 조건/부분 */
  note?: string;
  /** 보조 작용(assists) 여부 */
  accessory?: boolean;
}

export interface Innervation {
  nerve: string;
  /** 예: ['L4', 'L5', 'S1'] */
  roots: string[];
  note?: string;
}

export interface ClinicalTest {
  name: string;
  /** 무엇을 보는 검사인지, 양성 소견 */
  note: string;
}

export interface MMT {
  position: string;
  stabilization?: string;
  resistance: string;
  substitution?: string;
}

export interface Clinical {
  palpation?: string;
  mmt?: MMT;
  tests?: ClinicalTest[];
  /** 약화/단축/손상 시 흔한 dysfunction, movement impairment */
  dysfunction?: string[];
  notes?: string[];
}

export interface Muscle {
  /** kebab-case 고유 id. 예: 'gluteus-medius' */
  id: string;
  name: string;
  aliases?: string[];
  region: RegionId;
  /** 예: 'Gluteal region', 'Posterior thigh' */
  group: string;
  origin: string[];
  insertion: string[];
  actions: Action[];
  innervation: Innervation[];
  bloodSupply: string[];
  clinical?: Clinical;
  synergists?: string[];
  antagonists?: string[];
  /** 출처 간 차이가 있는 항목에 대한 메모 */
  sourceNote?: string;
}
