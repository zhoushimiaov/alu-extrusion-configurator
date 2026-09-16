// 光轴木展车材质组：桦木/橡木/胡桃胶合板 + 洞洞板 + 镀铬光轴 + 夹块
import * as THREE from 'three';

const cache = new Map();

function makeWoodTexture(baseHex, streakHex) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + baseHex.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 120; i++) {
    const y = Math.random() * 256;
    const h = 1 + Math.random() * 2.5;
    g.fillStyle = 'rgba(' + streakHex + ',' + (0.10 + Math.random() * 0.14).toFixed(2) + ')';
    g.fillRect(0, y, 256, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function getWoodCartMaterials(woodTone) {
  const key = 'woodcart:' + woodTone;
  if (cache.has(key)) return cache.get(key);
  const tones = {
    birch: { base: 0xd8bd8f, streak: '150,110,60' },
    oak: { base: 0xc49a6c, streak: '120,80,40' },
    walnut: { base: 0x6b4a32, streak: '35,20,10' },
  }[woodTone] || { base: 0xd8bd8f, streak: '150,110,60' };

  const wood = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.66, metalness: 0.02,
    map: makeWoodTexture(tones.base, tones.streak),
    envMapIntensity: 0.45,
  });
  // 洞洞板：同木色 + 程序化孔洞法线（简化：点阵贴图叠加暗孔）
  const pegTex = makeWoodTexture(tones.base, tones.streak);
  const pc = document.createElement('canvas');
  pc.width = pc.height = 256;
  const pg = pc.getContext('2d');
  pg.drawImage(pegTex.image, 0, 0);
  pg.fillStyle = 'rgba(60,45,25,0.55)';
  for (let y = 12; y < 256; y += 22) {
    for (let x = 12; x < 256; x += 22) {
      pg.beginPath(); pg.arc(x, y, 4.2, 0, Math.PI * 2); pg.fill();
    }
  }
  const pegMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.7, metalness: 0.02,
    map: new THREE.CanvasTexture(pc),
    envMapIntensity: 0.4,
  });

  const out = {
    wood,
    pegboard: pegMat,
    rod: new THREE.MeshPhysicalMaterial({ color: 0xd8dde2, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.1, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
    clamp: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.45, metalness: 0.7 }),
  };
  cache.set(key, out);
  return out;
}
