// 移动边几材质组：2040 木纹立柱 / 2020 铝梁 / 钢化玻璃 / 橙色亚克力 / 磨砂亚克力 / 镀铬光轴 / 夹块
import * as THREE from 'three';

const cache = new Map();

/** 木纹纹理：竖向木纹条 + 少量节疤（CanvasTexture 程序化，避免外部资源）。按饰面底色各生成一份——
 *  此前全部饰面共用一张原木色贴图且材质色被重置为白，「胡桃色」选项实际渲染与原木色相同。 */
const woodTexCache = new Map();
function getWoodTexture(base, dark, light) {
  if (woodTexCache.has(base)) return woodTexCache.get(base);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128;
    const w = 1 + Math.random() * 3;
    g.fillStyle = Math.random() < 0.6 ? dark : light;
    g.fillRect(x, 0, w, 512);
  }
  // 少量节疤
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * 128, y = Math.random() * 512;
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(x, y, 2 + Math.random() * 3, 4 + Math.random() * 6, 0, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  woodTexCache.set(base, tex);
  return tex;
}
// 饰面贴图色：原木色对齐参考图暖调山毛榉，胡桃为深褐
const WOOD_TEX = {
  oak: ['#d6a978', 'rgba(140,95,50,0.20)', 'rgba(240,210,165,0.22)'],
  walnut: ['#6e4b33', 'rgba(40,24,12,0.30)', 'rgba(150,110,80,0.18)'],
};

export function getCartMaterials(woodFinish) {
  const key = 'cart:' + woodFinish;
  if (cache.has(key)) return cache.get(key);

  const woodHex = { oak: 0xc9a875, walnut: 0x6b4a32, natural: 0xd4d8dc }[woodFinish] || 0xc9a875;
  const useWood = woodFinish !== 'natural';

  const post = new THREE.MeshPhysicalMaterial({
    color: useWood ? 0xffffff : woodHex,   // 木纹贴膜用 map 上色；铝原色直接上色
    roughness: useWood ? 0.62 : 0.35,
    metalness: useWood ? 0.05 : 0.75,
    map: useWood ? getWoodTexture(...(WOOD_TEX[woodFinish] || WOOD_TEX.oak)) : null,
    envMapIntensity: useWood ? 0.42 : 1.0,
  });
  if (useWood) post.color.set(0xffffff);

  const beam = new THREE.MeshPhysicalMaterial({
    color: 0xd4d8dc, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.0,
  });

  // 钢化玻璃：真实透射（薄板、低粗糙）
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xf3faf7, roughness: 0.04, metalness: 0,
    transmission: 1, thickness: 0.008, ior: 1.5,
    attenuationColor: 0xcfe9de, attenuationDistance: 0.6,   // 浮法玻璃微绿
    envMapIntensity: 1.15,
  });
  // 玻璃侧边：参考图台面一圈绿边（侧向光程长，铁含量呈色）
  const glassEdge = new THREE.MeshStandardMaterial({
    color: 0x5fa78c, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.72, envMapIntensity: 1.0,
  });

  // 橙色亚克力：有色透射 + 厚度衰减
  const amber = new THREE.MeshPhysicalMaterial({
    color: 0xf0971f, roughness: 0.16, metalness: 0,
    transmission: 0.92, thickness: 0.006, ior: 1.49,
    attenuationColor: 0xe8891c, attenuationDistance: 0.04,
    envMapIntensity: 0.9,
  });

  // 磨砂亚克力：透射 + 高粗糙
  const frost = new THREE.MeshPhysicalMaterial({
    color: 0xeef1f4, roughness: 0.45, metalness: 0,
    transmission: 1, thickness: 0.006, ior: 1.49,
    envMapIntensity: 0.7,
  });

  const rod = new THREE.MeshPhysicalMaterial({
    color: 0xd8dde2, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.1,
    clearcoat: 0.9, clearcoatRoughness: 0.08,
  });

  // 夹块 / 光轴支座：喷砂铝本色（参考图银白夹块）
  const clamp = new THREE.MeshStandardMaterial({
    color: 0xc9cdd1, roughness: 0.34, metalness: 0.82, envMapIntensity: 1.05,
  });

  // 轮胎：黑色橡胶（哑光，参考图轮体）
  const tire = new THREE.MeshStandardMaterial({
    color: 0x1c1e21, roughness: 0.88, metalness: 0.05,
  });

  // 沉头 / 内六角螺丝头：深色发黑件（参考图木板上的黑色螺丝孔）
  const screw = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.45, metalness: 0.6 });

  const out = { post, beam, glass, glassEdge, amber, frost, rod, clamp, tire, screw };
  cache.set(key, out);
  return out;
}
