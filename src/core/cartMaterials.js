// 移动边几材质组：2040 木纹立柱 / 2020 铝梁 / 钢化玻璃 / 橙色亚克力 / 磨砂亚克力 / 镀铬光轴 / 夹块
import * as THREE from 'three';

const cache = new Map();

/** 木纹纹理：竖向浅色木纹条（CanvasTexture 程序化，避免外部资源） */
let woodTex = null;
function getWoodTexture() {
  if (woodTex) return woodTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a875';
  g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128;
    const w = 1 + Math.random() * 3;
    const v = Math.random() < 0.6 ? 'rgba(150,110,60,0.16)' : 'rgba(230,200,150,0.20)';
    g.fillStyle = v;
    g.fillRect(x, 0, w, 512);
  }
  // 少量节疤
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * 128, y = Math.random() * 512;
    g.fillStyle = 'rgba(120,85,45,0.25)';
    g.beginPath(); g.ellipse(x, y, 2 + Math.random() * 3, 4 + Math.random() * 6, 0, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  woodTex = tex;
  return tex;
}

export function getCartMaterials(woodFinish) {
  const key = 'cart:' + woodFinish;
  if (cache.has(key)) return cache.get(key);

  const woodHex = { oak: 0xc9a875, walnut: 0x6b4a32, natural: 0xd4d8dc }[woodFinish] || 0xc9a875;
  const useWood = woodFinish !== 'natural';

  const post = new THREE.MeshPhysicalMaterial({
    color: useWood ? 0xffffff : woodHex,   // 木纹贴膜用 map 上色；铝原色直接上色
    roughness: useWood ? 0.62 : 0.35,
    metalness: useWood ? 0.05 : 0.75,
    map: useWood ? getWoodTexture() : null,
    envMapIntensity: useWood ? 0.5 : 1.0,
  });
  if (useWood) post.color.set(0xffffff);

  const beam = new THREE.MeshPhysicalMaterial({
    color: 0xd4d8dc, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.0,
  });

  // 钢化玻璃：真实透射（薄板、低粗糙）
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.04, metalness: 0,
    transmission: 1, thickness: 0.006, ior: 1.5,
    envMapIntensity: 1.15,
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

  const clamp = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6, roughness: 0.45, metalness: 0.7,
  });

  const out = { post, beam, glass, amber, frost, rod, clamp };
  cache.set(key, out);
  return out;
}
