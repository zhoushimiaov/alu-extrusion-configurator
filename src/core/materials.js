// 材质工厂：拉丝阳极氧化铝（各向异性 + 程序化粗糙度贴图）/ 玻璃 / 压铸角件
import * as THREE from 'three';
import { COLORS } from '../config/product.js';

const cache = new Map();
let brushedTex = null;

/** 拉丝纹理：水平细划痕，作 roughnessMap 让金属出现方向性高光 */
function getBrushedTexture() {
  if (brushedTex) return brushedTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#8c8c8c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    const y = Math.random() * 512;
    const len = 40 + Math.random() * 220;
    const x = Math.random() * 512;
    const v = 110 + Math.floor(Math.random() * 90);
    g.strokeStyle = `rgba(${v},${v},${v},${0.10 + Math.random() * 0.22})`;
    g.lineWidth = Math.random() < 0.85 ? 1 : 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  brushedTex = tex;
  return tex;
}

export function getAluMaterial(colorKey) {
  const key = `alu:${colorKey}`;
  if (cache.has(key)) return cache.get(key);
  const c = COLORS[colorKey] || COLORS.silver;
  const mat = new THREE.MeshPhysicalMaterial({
    color: c.hex,
    roughness: c.roughness,
    metalness: c.metalness,
    roughnessMap: getBrushedTexture(),
    anisotropy: 0.55,
    envMapIntensity: 1.05,
  });
  cache.set(key, mat);
  return mat;
}

export function getConnectorMaterial() {
  const key = 'conn';
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a3e44,
    roughness: 0.42,
    metalness: 0.75,
    envMapIntensity: 0.95,
  });
  cache.set(key, mat);
  return mat;
}

export function getAcrylicMaterial() {
  const key = 'acrylic';
  if (cache.has(key)) return cache.get(key);
  // 磨砂亚克力：真实透射 + 中等粗糙度（乳白磨砂感来自粗糙透射而非不透明度）
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f5f7,
    roughness: 0.42,
    metalness: 0,
    transmission: 1,
    thickness: 0.01,
    ior: 1.49,
    envMapIntensity: 0.8,
  });
  cache.set(key, mat);
  return mat;
}

/** 光轴展架材质组：杆体镀铬/黑/拉丝 + 镀锌板 + 夹块深灰 + 海报白 */
export function getRodMaterials(colorKey) {
  const key = 'rod:' + colorKey;
  if (cache.has(key)) return cache.get(key);
  const c = { chrome: { hex: 0xd8dde2, roughness: 0.12, metalness: 1.0 }, black: { hex: 0x2a2d31, roughness: 0.45, metalness: 0.85 }, steel: { hex: 0xb8bdc3, roughness: 0.30, metalness: 0.95 } }[colorKey] || { hex: 0xd8dde2, roughness: 0.12, metalness: 1.0 };
  // clearcoat：杆体表面一层清漆感镜面，镀铬/不锈钢的"湿亮"来自这里
  const mk = (hex, rough, metal) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, metalness: metal, envMapIntensity: 1.1, clearcoat: 0.9, clearcoatRoughness: 0.08 });
  const out = {
    rod: mk(c.hex, c.roughness, c.metalness),
    zinc: new THREE.MeshStandardMaterial({ color: 0xc3c8cd, roughness: 0.38, metalness: 0.75, envMapIntensity: 0.9 }),
    block: new THREE.MeshStandardMaterial({ color: 0x2e3237, roughness: 0.5, metalness: 0.6 }),
    poster: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.7, metalness: 0.1 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.88, metalness: 0 }),
    posterPanel: new THREE.MeshStandardMaterial({ color: 0xf0f1ee, roughness: 0.78, metalness: 0.02 }),
    // 透明亚克力薄板：真实透射
    acrylicClear: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 1, thickness: 0.004, ior: 1.49, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    printStrip: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.65, metalness: 0.05, transparent: true, opacity: 0.75 }),
  };
  cache.set(key, out);
  return out;
}

/** 摆件材质组：书包织物 / 书本纸白与彩色书脊 / 花瓶陶白 / 收纳盒深灰 */
export function getPropMaterials() {
  const key = 'props';
  if (cache.has(key)) return cache.get(key);
  const mk = (hex, rough, metal = 0) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
  const out = {
    bag: [mk(0x4a5568, 0.85), mk(0x6b4f3a, 0.88), mk(0x37424f, 0.85)],
    books: [mk(0xd8d3c8, 0.9), mk(0x8a2f2a, 0.82), mk(0x2f4a6b, 0.82), mk(0x3f5a3a, 0.82)],
    vase: [mk(0xeae6df, 0.65), mk(0xc9c2b6, 0.7)],
    box: [mk(0x3a3d42, 0.72), mk(0x565b63, 0.72)],
  };
  cache.set(key, out);
  return out;
}

export function getFootMaterial() {
  const key = 'foot';
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a1b1e,
    roughness: 0.62,
    metalness: 0.3,
  });
  cache.set(key, mat);
  return mat;
}

export function disposeMaterialCache() {
  for (const mat of cache.values()) mat.dispose();
  cache.clear();
}

/** Saw-cut face, independent of anodized color. */
export function getCutMaterial(){return new THREE.MeshStandardMaterial({color:0xd4d8dc,roughness:.64,metalness:.82});}
