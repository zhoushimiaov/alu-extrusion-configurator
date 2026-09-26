// 层板条 LOD 纹理：一个 Tile = 一跨的板条纹理（20mm 间距条纹 + 亮度微差）。
// 远景下真实板条几何亚像素化产生摩尔纹；带 mipmap 的贴图随距离平滑淡化为均匀灰，
// 以此替换远景几何（LOD 切换在 main.js 渲染循环按相机距离做）。
import * as THREE from 'three';

let shared = null;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getPlankTexture() {
  if (shared) return shared;
  if (typeof document === 'undefined') return null; // node 测试环境无 DOM：调用方跳过 map
  const W = 512, H = 64; // U = 跨宽方向（条纹沿 V 不变），V = 进深
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rand = mulberry32(20260927);
  const pitch = 16; // px/板条 ≈ 0.02m（Tile 对应一跨 ~0.5m）
  for (let x = 0; x < W; x += pitch) {
    const lum = 196 + Math.floor(rand() * 26); // 板条间亮度微差
    g.fillStyle = `rgb(${lum},${lum + 2},${lum + 5})`;
    g.fillRect(x, 0, pitch, H);
    // 板条间缝隙：1px 暗线
    g.fillStyle = 'rgba(70,74,80,0.55)';
    g.fillRect(x, 0, 1.5, H);
    // 板条内高光（⌀20 圆杆截面观感）
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x + 3, 0, pitch * 0.3, H);
  }
  shared = new THREE.CanvasTexture(c);
  shared.colorSpace = THREE.SRGBColorSpace;
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.anisotropy = 8;
  return shared;
}
