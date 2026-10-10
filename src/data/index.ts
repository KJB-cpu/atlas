import type { Muscle } from '../types';
import { lowerHipThigh } from './muscles/lowerHipThigh';
import { lowerLegFoot } from './muscles/lowerLegFoot';
import { upperShoulderArm } from './muscles/upperShoulderArm';
import { upperForearmHand } from './muscles/upperForearmHand';
import { trunk } from './muscles/trunk';

export const MUSCLES: Muscle[] = [
  ...upperShoulderArm,
  ...upperForearmHand,
  ...trunk,
  ...lowerHipThigh,
  ...lowerLegFoot,
];

export const MUSCLE_BY_ID: Map<string, Muscle> = new Map(MUSCLES.map((m) => [m.id, m]));
