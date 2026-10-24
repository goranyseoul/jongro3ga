"use client";

// FBO curl-noise particles from the IRONACT design system (primitives/code/hero/fbo-particles-scene.tsx,
// PA landing). Kept: the simulation shader and cursor push. Changed: the colour comes from the --particle
// token, the cursor is measured against this canvas instead of the window, and the cloud eases to a smaller
// pose while the chat is in use. Owner decision 2026-10-24: plain particles, no shape forms out of them.

import { Canvas, createPortal, extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const simulationVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const simulationFragmentShader = /* glsl */ `
  uniform sampler2D positions;
  uniform float uTime;
  uniform float uFrequency;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  varying vec2 vUv;

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 =   v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  vec3 snoiseVec3(vec3 x){
    float s  = snoise(vec3(x));
    float s1 = snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2));
    float s2 = snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4));
    return vec3(s, s1, s2);
  }

  vec3 curlNoise(vec3 p){
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    vec3 p_x0 = snoiseVec3(p - dx); vec3 p_x1 = snoiseVec3(p + dx);
    vec3 p_y0 = snoiseVec3(p - dy); vec3 p_y1 = snoiseVec3(p + dy);
    vec3 p_z0 = snoiseVec3(p - dz); vec3 p_z1 = snoiseVec3(p + dz);
    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
    return normalize(vec3(x, y, z) * (1.0 / (2.0 * e)));
  }

  void main() {
    vec3 lowCurl  = curlNoise(texture2D(positions, vUv).rgb * uFrequency + uTime * 0.1);
    vec3 highCurl = curlNoise(texture2D(positions, vUv).rgb * uFrequency + uTime * 0.1);
    highCurl += curlNoise(highCurl * uFrequency * 2.0) * 0.5;
    vec3 finalPos = mix(lowCurl, highCurl, sin(uTime));

    float mDist = distance(finalPos.xy, uMouse);
    float push  = smoothstep(0.9, 0.0, mDist) * uMouseStrength;
    finalPos.xy += normalize(finalPos.xy - uMouse + vec2(0.0001)) * push * 0.25;

    gl_FragColor = vec4(finalPos, 1.0);
  }
`;

const renderVertexShader = /* glsl */ `
  uniform sampler2D uPositions;
  uniform float uPointSize;
  void main() {
    vec3 pos = texture2D(uPositions, position.xy).xyz;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_PointSize = uPointSize * (step(1.0 - (1.0 / 64.0), position.x) + 0.6);
  }
`;

const renderFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    // round points with a soft edge
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, 0.9 * smoothstep(0.5, 0.2, d));
  }
`;

const SIZE = 128; // 16,384 particles

function randomCloud(size: number) {
  const data = new Float32Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const distance = Math.sqrt(Math.random()) * 2.0;
    const theta = THREE.MathUtils.randFloatSpread(360);
    const phi = THREE.MathUtils.randFloatSpread(360);
    data[i * 4] = distance * Math.sin(theta) * Math.cos(phi);
    data[i * 4 + 1] = distance * Math.sin(theta) * Math.sin(phi);
    data[i * 4 + 2] = distance * Math.cos(theta);
    data[i * 4 + 3] = 1;
  }
  return data;
}

function floatTexture(data: Float32Array, size: number) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}

class SimulationMaterial extends THREE.ShaderMaterial {
  constructor(size: number) {
    super({
      uniforms: {
        positions: { value: floatTexture(randomCloud(size), size) },
        uFrequency: { value: 0.25 },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(9, 9) },
        uMouseStrength: { value: 0.6 },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
    });
  }
}

extend({ SimulationMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    simulationMaterial: ThreeElement<typeof SimulationMaterial>;
  }
}

/** Reads a CSS colour token as linear RGB for the shader, through a 1px canvas so any CSS colour syntax works. */
function readTokenColor(el: HTMLElement, token: string): THREE.Color {
  const value = getComputedStyle(el).getPropertyValue(token).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!value || !ctx) return new THREE.Color(1, 1, 1);
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

type FieldProps = { still: boolean; shrink: boolean; mouse: { current: { x: number; y: number } } };

// Resting pose fills the hero behind its copy; while the chat is in use the cloud draws in and drifts up.
const REST = { y: 0, scale: 1.5 };
const ENGAGED = { y: 0.5, scale: 0.9 };

function ParticleField({ still, shrink, mouse }: FieldProps) {
  const points = useRef<THREE.Points>(null!);
  // eased state read inside useFrame, so a focus change never re-renders the canvas
  const shrinkRef = useRef(shrink);
  const burstRef = useRef(0);
  useEffect(() => {
    if (shrink !== shrinkRef.current) {
      shrinkRef.current = shrink;
      burstRef.current = 0.7; // dissolve, then settle at the new size (PA phase choreography)
    }
  }, [shrink]);
  const simulation = useRef<SimulationMaterial>(null!);
  const colorRead = useRef(false);

  const scene = useMemo(() => new THREE.Scene(), []);
  // The simulation quad sits at z 0. The original put the camera there too with a near plane of 2^-53,
  // which some GL backends clip, leaving every particle at the origin; keep the quad well inside the frustum.
  const camera = useMemo(() => {
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    ortho.position.z = 1;
    return ortho;
  }, []);
  const quad = useMemo(() => new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), []);
  const quadUv = useMemo(() => new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), []);
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(SIZE, SIZE, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false,
        type: THREE.FloatType,
      }),
    [],
  );
  const lookup = useMemo(() => {
    const data = new Float32Array(SIZE * SIZE * 3);
    for (let i = 0; i < SIZE * SIZE; i++) {
      data[i * 3] = (i % SIZE) / SIZE;
      data[i * 3 + 1] = i / SIZE / SIZE;
    }
    return data;
  }, []);
  const uniforms = useMemo(
    () => ({
      uPositions: { value: null as THREE.Texture | null },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uPointSize: { value: 2.2 },
    }),
    [],
  );

  useEffect(() => () => target.dispose(), [target]);

  useFrame((state) => {
    const { gl, clock } = state;
    // write to the material r3f actually built; it does not keep the uniforms prop object by reference
    const render = (points.current.material as THREE.ShaderMaterial).uniforms;
    if (!colorRead.current) {
      render.uColor.value = readTokenColor(gl.domElement, "--particle");
      render.uPointSize.value = 2.2 * Math.min(gl.getPixelRatio(), 1.5);
      colorRead.current = true;
    }
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    render.uPositions.value = target.texture;

    const t = still ? 0 : clock.elapsedTime;
    const u = simulation.current.uniforms;
    u.uTime.value = t;
    burstRef.current *= 0.92;
    u.uFrequency.value = 0.25 + burstRef.current * 1.3;
    const pose = shrinkRef.current ? ENGAGED : REST;
    const p = points.current;
    // world units visible at the field plane: camera z 4, fov 50 gives a half height near 1.86
    const aspect = state.size.width / Math.max(1, state.size.height);
    p.position.y += (pose.y - p.position.y) * 0.06;
    // stretched across the width so the hero is filled edge to edge, not just a ball in the middle
    const spread = pose.scale * Math.max(1, aspect * 0.75);
    p.scale.x += (spread - p.scale.x) * 0.06;
    p.scale.y += (pose.scale - p.scale.y) * 0.06;
    p.scale.z = p.scale.y;
    p.rotation.y = still ? 0 : Math.sin(t * 0.08) * 0.25; // sways instead of turning, so the stretch never shows its edge
    u.uMouse.value.set(mouse.current.x * 1.86 * aspect, mouse.current.y * 1.86);
  });

  return (
    <>
      {createPortal(
        <mesh>
          <simulationMaterial ref={simulation} args={[SIZE]} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[quad, 3]} />
            <bufferAttribute attach="attributes-uv" args={[quadUv, 2]} />
          </bufferGeometry>
        </mesh>,
        scene,
      )}
      <points ref={points} position={[0, REST.y, 0]} scale={REST.scale}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lookup, 3]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          fragmentShader={renderFragmentShader}
          vertexShader={renderVertexShader}
          uniforms={uniforms}
        />
      </points>
    </>
  );
}

export default function ParticleFieldScene({ still, shrink }: { still: boolean; shrink: boolean }) {
  const mouse = useRef({ x: 9, y: 9 }); // far away until the pointer moves
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const rect = wrap.current?.getBoundingClientRect();
      if (!rect) return;
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={wrap} className="size-full">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      >
        <ParticleField still={still} shrink={shrink} mouse={mouse} />
      </Canvas>
    </div>
  );
}
