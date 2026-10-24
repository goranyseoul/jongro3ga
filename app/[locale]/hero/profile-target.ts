// Procedural 3D head of a woman in profile, facing right, as a particle target.
// Pose after the owner's reference (eyes lowered, high nose bridge, full lips, hair pulled back into a bun);
// nothing is traced from the photo. The head is lofted from a side profile: at each height an ellipse
// spans the face front f(y) to the skull back b(y) with half width w(y); the nose and lips sit on the
// front as a narrow ridge. Face coordinates: x across (left to right of the face), y up, z forward.
// The output maps face z to world X so the face looks to the right. Seeded: the same head every visit.

type Table = [number, number][]; // [y, value], y descending

function sample(table: Table, y: number): number {
  if (y >= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    const [y0, v0] = table[i - 1];
    if (y >= y1) {
      const t = (y0 - y) / (y0 - y1);
      const s = (1 - Math.cos(Math.PI * t)) / 2; // cosine ease keeps the profile smooth between keys
      return v0 + (v1 - v0) * s;
    }
  }
  return table[table.length - 1][1];
}

// midline profile: crown, forehead, brow, bridge, nose tip, lips, chin, neck
const FRONT: Table = [
  [1.12, 0], [1.0, 0.32], [0.85, 0.5], [0.6, 0.64], [0.4, 0.71], [0.3, 0.74], [0.18, 0.69],
  [0.05, 0.8], [-0.08, 0.92], [-0.19, 1.02], [-0.25, 0.98], [-0.3, 0.82], [-0.36, 0.8],
  [-0.43, 0.86], [-0.5, 0.78], [-0.57, 0.84], [-0.66, 0.73], [-0.72, 0.71], [-0.84, 0.79],
  [-0.95, 0.68], [-1.02, 0.45], [-1.08, 0.3], [-1.3, 0.27], [-1.8, 0.32],
];
// the face plane without nose and lips
const BASE: Table = [
  [1.12, 0], [1.0, 0.32], [0.85, 0.5], [0.6, 0.64], [0.4, 0.71], [0.3, 0.72], [0.18, 0.66],
  [0, 0.62], [-0.3, 0.6], [-0.6, 0.6], [-0.8, 0.68], [-0.95, 0.66], [-1.02, 0.45], [-1.08, 0.3],
  [-1.3, 0.27], [-1.8, 0.32],
];
const BACK: Table = [
  [1.12, 0], [1.0, -0.42], [0.8, -0.66], [0.5, -0.78], [0.2, -0.77], [-0.1, -0.66], [-0.4, -0.47],
  [-0.6, -0.36], [-1.0, -0.3], [-1.8, -0.32],
];
const WIDTH: Table = [
  [1.12, 0.05], [1.0, 0.45], [0.8, 0.64], [0.4, 0.72], [0, 0.7], [-0.4, 0.6], [-0.75, 0.45],
  [-0.95, 0.32], [-1.1, 0.3], [-1.8, 0.32],
];

/** Point on the head surface at height y and angle theta (0 = straight ahead), pushed out by `offset`. */
function headPoint(y: number, theta: number, offset = 0): [number, number] {
  const base = sample(BASE, y);
  const back = sample(BACK, y);
  const w = sample(WIDTH, y) + offset;
  const c = (base + back) / 2;
  const d = (base - back) / 2 + offset;
  const x = w * Math.sin(theta);
  let z = c + d * Math.cos(theta);
  if (Math.cos(theta) > 0) z += Math.max(0, sample(FRONT, y) - base) * Math.exp(-((x / 0.1) ** 2));
  return [x, z];
}

/** Angle on the face's side (x > 0) where the surface reaches depth z at height y. */
function sideTheta(y: number, z: number): number {
  const base = sample(BASE, y);
  const back = sample(BACK, y);
  const c = (base + back) / 2;
  const d = (base - back) / 2;
  return Math.acos(Math.max(-1, Math.min(1, (z - c) / d)));
}

/** Hairline height at angle theta: high on the forehead, above the ear on the side, low at the nape. */
const hairline = (theta: number) => {
  const c = Math.cos(theta);
  return c >= 0 ? 0.25 + 0.53 * c : 0.25 + 0.7 * c;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildProfileTarget(count: number, seed = 11): Float32Array {
  const rand = mulberry32(seed);
  const jitter = (n: number) => (rand() - 0.5) * n;
  const out = new Float32Array(count * 4);
  let i = 0;
  // face (x, y, z) -> world (X = z forward to the right, Y = y, Z = x toward the viewer),
  // with the head bowed slightly so the gaze falls, as in the reference pose
  const bow = -0.12;
  const cb = Math.cos(bow);
  const sb = Math.sin(bow);
  const push = (x: number, y: number, z: number) => {
    if (i >= count) return;
    out[i * 4] = z * cb - y * sb;
    out[i * 4 + 1] = z * sb + y * cb;
    out[i * 4 + 2] = x;
    out[i * 4 + 3] = 1;
    i++;
  };
  const onSide = (y: number, z: number, lift = 0.012) => {
    const [x, zz] = headPoint(y, sideTheta(y, z), lift);
    push(x + jitter(0.005), y + jitter(0.005), zz + jitter(0.005));
  };

  const budget = (share: number) => i + Math.floor(count * share);

  // 1. skin: head and neck surface, thinning out down the neck
  const skinEnd = budget(0.4);
  while (i < skinEnd) {
    const y = -1.35 + rand() * 2.47;
    if (y < -1.1 && rand() > 1 - (y + 1.35) / 0.25) continue;
    const theta = rand() * Math.PI * 2;
    if (y > hairline(theta) + 0.02) continue; // hair covers it
    const [x, z] = headPoint(y, theta);
    push(x, y, z);
  }

  // 2. the profile line itself, dense, from the hairline down to the throat
  const profileEnd = budget(0.07);
  while (i < profileEnd) {
    const y = -1.08 + rand() * 1.86;
    push(jitter(0.03), y, sample(FRONT, y) + 0.006);
  }

  // 3. features on the side facing the camera
  const featureEnd = budget(0.13);
  const features: (() => void)[] = [
    () => {
      const t = rand(); // lowered upper lid
      onSide(0.1 - 0.025 * Math.sin(Math.PI * t), 0.42 + 0.2 * t);
    },
    () => {
      const t = rand(); // lashes falling forward and down from the lid
      const s = rand();
      onSide(0.09 - 0.025 * Math.sin(Math.PI * t) - 0.035 * s, 0.48 + 0.15 * t + 0.02 * s, 0.02);
    },
    () => {
      const t = rand(); // brow
      onSide(0.27 + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.2)) + jitter(0.02) * (1 - t), 0.38 + 0.3 * t);
    },
    () => {
      const t = rand() * Math.PI * 2; // nostril wing
      onSide(-0.245 + 0.045 * Math.sin(t), 0.79 + 0.06 * Math.cos(t), 0.02);
    },
    () => {
      const t = rand(); // mouth corner, tucked behind the lips
      onSide(-0.5 - 0.015 * t, 0.66 - 0.08 * t);
    },
    () => {
      const t = rand(); // jaw line, ear lobe to chin
      onSide(-0.14 - 0.78 * t, -0.12 + 0.72 * t ** 1.3);
    },
    () => {
      const t = rand() * Math.PI * 2; // ear rim
      const y = 0.0 + 0.13 * Math.sin(t);
      const [x, z] = headPoint(y, sideTheta(y, -0.12 + 0.065 * Math.cos(t)), 0.03);
      push(x, y, z);
    },
  ];
  let k = 0;
  while (i < featureEnd) {
    features[k % features.length]();
    k++;
  }

  // 4. hair: volume on the scalp, strands combed back, the bun
  const bunY = 0.42;
  const bunZ = sample(BACK, bunY) - 0.16;
  const capEnd = budget(0.14);
  while (i < capEnd) {
    const y = -0.45 + rand() * 1.55;
    const theta = rand() * Math.PI * 2;
    if (y <= hairline(theta)) continue;
    const [x, z] = headPoint(Math.min(y, 1.08), theta, 0.03 + rand() * 0.03);
    push(x, Math.min(y, 1.1), z);
  }
  const strandEnd = budget(0.18);
  while (i < strandEnd) {
    const start = (rand() * 2 - 1) * Math.PI * 0.85;
    const t = rand();
    const theta = start + (Math.sign(start) * Math.PI - start) * t;
    const lift = 0.45 * Math.sin(Math.PI * t) * Math.max(0, Math.cos(start));
    const y = Math.min(1.08, hairline(start) + 0.02 + (bunY - hairline(start)) * t + lift);
    const [x, z] = headPoint(y, theta, 0.05);
    push(x + jitter(0.006), y + jitter(0.006), z + jitter(0.006));
  }
  while (i < count) {
    const u = rand() * Math.PI * 2;
    const v = Math.acos(2 * rand() - 1);
    const r = 0.26 * (0.92 + 0.08 * Math.sin(u * 6 + v * 4)); // twisted bun
    push(r * Math.sin(v) * Math.cos(u), bunY + r * Math.cos(v), bunZ + r * Math.sin(v) * Math.sin(u) * 0.8);
  }

  return out;
}
