// Procedural 3D face mask of a woman as a particle target: only the front of the face, floating, no skull,
// neck or hair. Proportions follow the owner's references (straight bridge, slightly lifted tip, full lips,
// small rounded chin, soft cheekbones); nothing is traced from the photos. The mask is lofted from a side
// profile like a head, then cut to the face and given relief (eye sockets, eyeballs, cheekbones, lips).
// A scan look comes from contour rings and meridians; a dense rim outlines the mask.
// Face coordinates: x across, y up, z toward the viewer. Seeded: the same mask every visit.

type Table = [number, number][]; // [y, value], y descending

function sample(table: Table, y: number): number {
  if (y >= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    const [y0, v0] = table[i - 1];
    if (y >= y1) {
      const t = (y0 - y) / (y0 - y1);
      return v0 + (v1 - v0) * ((1 - Math.cos(Math.PI * t)) / 2);
    }
  }
  return table[table.length - 1][1];
}

// midline profile: forehead, brow, bridge, tip, philtrum, lips, chin
const FRONT: Table = [
  [1.0, 0.32], [0.85, 0.5], [0.6, 0.63], [0.4, 0.69], [0.3, 0.7], [0.2, 0.67], [0.05, 0.75],
  [-0.1, 0.86], [-0.2, 0.93], [-0.25, 0.9], [-0.29, 0.78], [-0.36, 0.79], [-0.44, 0.84],
  [-0.5, 0.79], [-0.56, 0.82], [-0.64, 0.72], [-0.7, 0.7], [-0.8, 0.74], [-0.9, 0.68], [-1.0, 0.48],
];
// the face plane under the nose and lips
const BASE: Table = [
  [1.0, 0.32], [0.85, 0.5], [0.6, 0.63], [0.4, 0.69], [0.3, 0.69], [0.2, 0.65], [0, 0.62],
  [-0.3, 0.6], [-0.6, 0.6], [-0.8, 0.66], [-0.9, 0.64], [-1.0, 0.48],
];
const BACK: Table = [[1.0, -0.42], [0.5, -0.78], [0.2, -0.77], [-0.1, -0.66], [-0.4, -0.47], [-1.0, -0.3]];
const WIDTH: Table = [[1.0, 0.45], [0.8, 0.64], [0.4, 0.72], [0, 0.7], [-0.4, 0.6], [-0.75, 0.45], [-1.0, 0.3]];

const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);

/** Point on the mask at height y and angle theta (0 = straight ahead). */
function maskPoint(y: number, theta: number, lift = 0): [number, number] {
  const base = sample(BASE, y);
  const back = sample(BACK, y);
  const w = sample(WIDTH, y);
  const c = (base + back) / 2;
  const d = (base - back) / 2;
  const x = w * Math.sin(theta);
  let z = c + d * Math.cos(theta);
  // the nose is narrow, the lips and chin are wide
  const ridge = y < -0.33 ? (y < -0.72 ? 0.26 : 0.19) : 0.085;
  z += Math.max(0, sample(FRONT, y) - base) * Math.exp(-((x / ridge) ** 2));
  const ax = Math.abs(x);
  z -= 0.09 * gauss(ax, y, 0.3, 0.1, 0.13, 0.08); // eye socket
  z += 0.045 * gauss(ax, y, 0.3, 0.09, 0.07, 0.04); // eyeball under the lid
  z += 0.05 * gauss(ax, y, 0.43, -0.15, 0.15, 0.12); // cheekbone
  z -= 0.025 * gauss(ax, y, 0.17, -0.42, 0.06, 0.12); // nasolabial softness
  z -= 0.02 * gauss(x, y, 0, -0.5, 0.2, 0.012); // mouth line
  return [x, z + lift];
}

// The mask edge: a curved hairline on top, the jaw at the bottom, the cheeks at the sides.
const THETA_MAX = 1.6;
const topEdge = (u: number) => 0.86 - 0.32 * u * u; // u = theta / THETA_MAX
const bottomEdge = (u: number) => -1.0 + 0.62 * u * u;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMaskTarget(count: number, seed = 5): Float32Array {
  const rand = mulberry32(seed);
  const jitter = (n: number) => (rand() - 0.5) * n;
  const out = new Float32Array(count * 4);
  let i = 0;
  // centre the mask on its own turning axis and bow it slightly so the gaze falls
  const zCentre = 0.5;
  const bow = 0.1;
  const cb = Math.cos(bow);
  const sb = Math.sin(bow);
  const push = (x: number, y: number, z: number) => {
    if (i >= count) return;
    const zz = z - zCentre;
    out[i * 4] = x;
    out[i * 4 + 1] = y * cb - zz * sb;
    out[i * 4 + 2] = y * sb + zz * cb;
    out[i * 4 + 3] = 1;
    i++;
  };
  const budget = (share: number) => i + Math.floor(count * share);
  const inside = (y: number, theta: number) => {
    const u = Math.abs(theta) / THETA_MAX;
    return u <= 1 && y <= topEdge(u) && y >= bottomEdge(u);
  };
  const at = (y: number, theta: number, lift = 0) => {
    const [x, z] = maskPoint(y, theta, lift);
    push(x, y, z);
  };
  const onFace = (x: number, y: number, lift = 0.012) => {
    // invert x -> theta on the loft, then add the relief
    const w = sample(WIDTH, y);
    const theta = Math.asin(Math.max(-1, Math.min(1, x / w)));
    const [, z] = maskPoint(y, theta, lift);
    push(x + jitter(0.005), y + jitter(0.005), z);
  };

  // 1. skin, sparse
  const skinEnd = budget(0.34);
  while (i < skinEnd) {
    const y = -1.0 + rand() * 1.86;
    const theta = (rand() * 2 - 1) * THETA_MAX;
    if (inside(y, theta)) at(y, theta);
  }

  // 2. scan rings and meridians, clipped to the mask
  const RINGS = 26;
  const ringEnd = budget(0.2);
  while (i < ringEnd) {
    const y = -1.0 + (Math.floor(rand() * RINGS) + 0.5) * (1.86 / RINGS);
    const theta = (rand() * 2 - 1) * THETA_MAX;
    if (inside(y, theta)) at(y, theta, 0.004);
  }
  const MERIDIANS = 11;
  const meridianEnd = budget(0.06);
  while (i < meridianEnd) {
    const theta = ((Math.floor(rand() * MERIDIANS) / (MERIDIANS - 1)) * 2 - 1) * THETA_MAX * 0.95;
    const y = -1.0 + rand() * 1.86;
    if (inside(y, theta)) at(y, theta, 0.004);
  }

  // 3. rim of the mask
  const rimEnd = budget(0.1);
  while (i < rimEnd) {
    const u = rand() * 2 - 1;
    const theta = u * THETA_MAX;
    const r = rand();
    if (r < 0.4) at(topEdge(Math.abs(u)), theta, 0.006);
    else if (r < 0.8) at(bottomEdge(Math.abs(u)), theta, 0.006);
    else {
      const side = rand() < 0.5 ? -1 : 1; // cheek edge
      const y = bottomEdge(1) + rand() * (topEdge(1) - bottomEdge(1));
      at(y, side * THETA_MAX, 0.006);
    }
  }

  // 4. profile line down the middle
  const profileEnd = budget(0.06);
  while (i < profileEnd) {
    const y = -0.98 + rand() * 1.8;
    push(jitter(0.025), y, sample(FRONT, y) + 0.006);
  }

  // 5. features: lowered lids, lashes, brows, nostrils, lips
  const lines: (() => void)[] = [];
  for (const s of [-1, 1]) {
    const cx = s * 0.3;
    lines.push(() => {
      const t = rand(); // lowered upper lid
      onFace(cx + 0.14 * Math.cos(Math.PI * t), 0.085 + 0.03 * Math.sin(Math.PI * t), 0.02);
    });
    lines.push(() => {
      const t = rand(); // lashes, pointing down
      const k = rand();
      onFace(cx + 0.13 * Math.cos(Math.PI * t) + s * 0.01 * k, 0.085 + 0.02 * Math.sin(Math.PI * t) - 0.035 * k, 0.03);
    });
    lines.push(() => {
      const t = rand(); // brow, fuller at the head
      onFace(cx + s * (-0.15 + 0.33 * t), 0.27 + 0.04 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + jitter(0.025) * (1 - t));
    });
    lines.push(() => {
      const t = rand() * Math.PI; // nostril wing
      onFace(s * (0.055 + 0.04 * Math.sin(t)), -0.26 - 0.03 * Math.cos(t), 0.02);
    });
  }
  lines.push(() => {
    const x = -0.19 + 0.38 * rand(); // upper lip with cupid's bow
    onFace(x, -0.47 + 0.03 * (1 - (x / 0.19) ** 2) - 0.012 * Math.exp(-((x / 0.035) ** 2)), 0.015);
  });
  lines.push(() => {
    const x = -0.17 + 0.34 * rand(); // lower lip
    onFace(x, -0.555 - 0.04 * (1 - (x / 0.17) ** 2), 0.015);
  });
  lines.push(() => onFace(-0.19 + 0.38 * rand(), -0.505, 0.01)); // mouth line
  let k = 0;
  while (i < count) {
    lines[k % lines.length]();
    k++;
  }

  return out;
}
