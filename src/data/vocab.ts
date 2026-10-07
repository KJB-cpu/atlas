import type { JointId, RegionId } from '../types';

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'lower', label: 'Lower extremity' },
  { id: 'upper', label: 'Upper extremity' },
  { id: 'trunk', label: 'Spine & Trunk' },
  { id: 'headNeck', label: 'Head & Neck' },
];

export const JOINT_LABELS: Record<JointId, string> = {
  pelvis: 'Pelvis',
  hip: 'Hip',
  knee: 'Knee',
  ankle: 'Ankle (talocrural)',
  foot: 'Foot (subtalar/midtarsal)',
  hallux: 'Great toe',
  toes: 'Lesser toes (2–5)',
  scapula: 'Scapula',
  shoulder: 'Shoulder (GH)',
  elbow: 'Elbow',
  forearm: 'Forearm (radioulnar)',
  wrist: 'Wrist',
  fingers: 'Fingers',
  thumb: 'Thumb',
  cervical: 'Cervical spine',
  trunk: 'Trunk (thoracolumbar)',
  ribs: 'Ribs / respiration',
  tmj: 'TMJ',
  head: 'Head',
};

/** 필터 표시 순서 */
export const JOINT_ORDER: JointId[] = Object.keys(JOINT_LABELS) as JointId[];

/** 신경근(root) 표시 순서 */
export const ROOT_ORDER = [
  'CN V', 'CN VII', 'CN XI',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
  'L1', 'L2', 'L3', 'L4', 'L5',
  'S1', 'S2', 'S3', 'S4',
];

export function rootRank(root: string): number {
  const i = ROOT_ORDER.indexOf(root);
  return i === -1 ? 999 : i;
}
