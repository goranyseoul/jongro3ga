// Procedural 3D woman's face as a particle target (x right, y up, z toward the camera).
// Surface relief gives depth while the head turns; extra points on eyes, brows, nose, lips and the
// jaw make the face read head-on; long hair strands frame it. Seeded, so every visit draws the same face.

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);

/** Half width of the face oval at height y; the chin tapers. */
function halfWidth(y: number): number {
  const k = 1 - ((y - 0.02) / 1.02) ** 2;
  if (k <= 0) return 0;
  const taper = y < -0.25 ? 1 - 0.4 * ((-0.25 - y) / 0.8) ** 1.6 : 1;
  return 0.76 * Math.sqrt(k) * taper;
}

/** Depth of the face surface at (x, y). */
function surfaceZ(x: number, y: number): number {
  const a = halfWidth(y);
  if (a <= 0) return 0;
  const u = Math.min(1, Math.abs(x) / a);
  let z = 0.5 * Math.sqrt(1 - u * u) + 0.08 * (1 - ((y - 0.05) / 1.1) ** 2);
  // nose ridge grows toward the tip, then the tip and the wings
  if (y > -0.3 && y < 0.22) z += (0.04 + 0.16 * ((0.22 - y) / 0.52)) * Math.exp(-((x / 0.055) ** 2));
  z += 0.08 * gauss(x, y, 0, -0.27, 0.09, 0.06);
  for (const s of [-1, 1]) {
    z += 0.035 * gauss(x, y, s * 0.09, -0.3, 0.05, 0.04);
    z -= 0.09 * gauss(x, y, s * 0.27, 0.12, 0.13, 0.08); // eye socket
    z += 0.04 * gauss(x, y, s * 0.27, 0.11, 0.07, 0.04); // eyeball
    z += 0.04 * gauss(x, y, s * 0.27, 0.27, 0.16, 0.05); // brow
    z += 0.06 * gauss(x, y, s * 0.4, -0.08, 0.14, 0.1); // cheekbone
  }
  z += 0.05 * gauss(x, y, 0, -0.5, 0.16, 0.035); // upper lip
  z += 0.06 * gauss(x, y, 0, -0.6, 0.14, 0.04); // lower lip
  z -= 0.02 * gauss(x, y, 0, -0.545, 0.17, 0.012); // mouth line
  z += 0.05 * gauss(x, y, 0, -0.85, 0.15, 0.08); // chin
  return z;
}

export function buildFaceTarget(count: number, seed = 7): Float32Array {
  const rand = mulberry32(seed);
  const jitter = (n: number) => (rand() - 0.5) * n;
  const out = new Float32Array(count * 4);
  let i = 0;
  const push = (x: number, y: number, z: number) => {
    if (i >= count) return;
    out[i * 4] = x;
    out[i * 4 + 1] = y;
    out[i * 4 + 2] = z;
    out[i * 4 + 3] = 1;
    i++;
  };
  const onFace = (x: number, y: number, lift = 0.012) => push(x + jitter(0.006), y + jitter(0.006), surfaceZ(x, y) + lift);

  const faceCount = Math.floor(count * 0.42);
  const lineCount = Math.floor(count * 0.27);

  // 1. face surface, sampled inside the oval
  while (i < faceCount) {
    const x = (rand() * 2 - 1) * 0.78;
    const y = -1.0 + rand() * 2.04;
    if (Math.abs(x) <= halfWidth(y)) push(x, y, surfaceZ(x, y) + jitter(0.01));
  }

  // 2. feature lines
  const lineEnd = faceCount + lineCount;
  const lines: ((t: number) => [number, number])[] = [];
  for (const s of [-1, 1]) {
    const cx = s * 0.27;
    lines.push((t) => [cx + 0.15 * Math.cos(Math.PI * t), 0.11 + 0.062 * Math.sin(Math.PI * t) ** 0.8]); // upper lid, almond
    lines.push((t) => [cx + 0.14 * Math.cos(Math.PI * t), 0.11 - 0.034 * Math.sin(Math.PI * t)]); // lower lid
    lines.push((t) => [cx + s * (0.15 + 0.05 * t), 0.115 + 0.03 * t]); // outer lash wing
    lines.push((t) => { const r = 0.045 * Math.sqrt(rand()); return [cx + r * Math.cos(2 * Math.PI * t), 0.115 + r * Math.sin(2 * Math.PI * t)]; }); // iris, filled
    lines.push((t) => [cx + s * (-0.16 + 0.34 * t), 0.27 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.3)) + (rand() - 0.5) * 0.03 * (1 - t)]); // brow, thicker at the head
    lines.push((t) => [s * (0.035 + 0.045 * t), 0.08 - 0.36 * t]); // side of the nose
    lines.push((t) => [s * (0.03 + 0.07 * Math.sin(Math.PI * t)), -0.3 - 0.025 * Math.sin(Math.PI * t)]); // nostril
  }
  lines.push((t) => {
    const x = -0.17 + 0.34 * t;
    return [x, -0.53 + 0.035 * (1 - (x / 0.17) ** 2) - 0.012 * Math.exp(-((x / 0.03) ** 2))]; // upper lip, cupid's bow
  });
  lines.push((t) => {
    const x = -0.16 + 0.32 * t;
    return [x, -0.56 - 0.045 * (1 - (x / 0.16) ** 2)]; // lower lip
  });
  lines.push((t) => [-0.16 + 0.32 * t, -0.547]); // mouth line
  lines.push((t) => {
    const y = 0.75 - 1.78 * t; // jaw and cheek contour, both sides
    return [halfWidth(y) * (t < 0.5 ? -1 : 1), y];
  });
  lines.push((t) => {
    const y = 0.75 - 1.78 * (1 - t);
    return [halfWidth(y), y];
  });
  let k = 0;
  while (i < lineEnd) {
    const [x, y] = lines[k % lines.length](rand());
    onFace(x, y);
    k++;
  }

  // 3. long hair, centre part, strands over the crown and down past the shoulders
  const strands = 260;
  while (i < count) {
    const n = Math.floor(rand() * strands);
    const side = n % 2 === 0 ? -1 : 1;
    const depth = (n % 13) / 12; // 0 front, 1 back
    const phase = n * 1.7;
    const t = rand();
    let x: number;
    let y: number;
    let z: number;
    if (t < 0.42) {
      const theta = (t / 0.42) * (Math.PI / 2) * 1.04; // over the crown, top to the side
      const r = 1.1 + depth * 0.14;
      x = side * 0.78 * r * Math.sin(theta);
      y = 0.05 + 1.12 * r * Math.cos(theta);
      z = 0.42 * Math.cos(theta) + 0.05 - depth * 0.8;
    } else {
      const d = (t - 0.42) / 0.58; // falling down the side
      x = side * (0.88 + depth * 0.16 + 0.2 * d + 0.035 * Math.sin(d * 9 + phase));
      y = 0.03 - 1.6 * d;
      z = 0.06 - depth * 0.75 - 0.1 * d;
    }
    push(x + jitter(0.012), y + jitter(0.012), z + jitter(0.02));
  }

  return out;
}
