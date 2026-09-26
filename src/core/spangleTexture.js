// 幻彩镀锌板程序化纹理：锌花结晶（放射枝晶）+ 淡彩干涉色，替代照片贴图零外部资产。
// 单例纹理：模块级共享，repeat 由使用方按板材尺寸设置。
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

// 一朵锌花：中心亮斑 + 6~9 条放射枝干（带分叉），边缘微暗收口
function drawFlake(g, cx, cy, r, rand) {
  const branches = 6 + Math.floor(rand() * 4);
  const rot = rand() * Math.PI * 2;
  const tints = ['rgba(190,205,235,', 'rgba(232,222,196,', 'rgba(196,226,208,', 'rgba(230,205,220,'];
  // 底色淡彩干涉斑
  g.fillStyle = tints[Math.floor(rand() * tints.length)] + (0.10 + rand() * 0.08) + ')';
  g.beginPath();
  g.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  g.fill();
  for (let b = 0; b < branches; b++) {
    const ang = rot + (b / branches) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const len = r * (0.55 + rand() * 0.45);
    const ex = cx + Math.cos(ang) * len, ey = cy + Math.sin(ang) * len;
    // 主枝：由宽渐细的亮银线
    g.strokeStyle = `rgba(238,241,245,${0.45 + rand() * 0.3})`;
    g.lineWidth = Math.max(1.5, r * 0.10);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(ex, ey);
    g.stroke();
    // 分叉小枝
    const twigs = 2 + Math.floor(rand() * 3);
    for (let t = 1; t <= twigs; t++) {
      const tt = t / (twigs + 1);
      const bx = cx + Math.cos(ang) * len * tt, by = cy + Math.sin(ang) * len * tt;
      const bl = len * 0.22 * (1 - tt * 0.5);
      const bang = ang + (rand() > 0.5 ? 1 : -1) * (0.6 + rand() * 0.5);
      g.lineWidth = Math.max(1, r * 0.05);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(bang) * bl, by + Math.sin(bang) * bl);
      g.stroke();
    }
    // 枝端亮点
    g.fillStyle = `rgba(245,247,250,${0.5 + rand() * 0.3})`;
    g.beginPath();
    g.arc(ex, ey, Math.max(1, r * 0.06), 0, Math.PI * 2);
    g.fill();
  }
  // 边缘微暗收口（与基板区分）
  g.strokeStyle = `rgba(120,127,136,${0.18 + rand() * 0.12})`;
  g.lineWidth = Math.max(1, r * 0.045);
  g.beginPath();
  g.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
  g.stroke();
}

export function getSpangleTexture() {
  if (shared) return shared;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // 基板：冷银竖向微渐变
  const base = g.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0, '#d3d7dc');
  base.addColorStop(0.5, '#c2c8cf');
  base.addColorStop(1, '#ccd1d7');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // 锌花：约 54 朵，直径 90~150px；棋盘化布点避免过度重叠
  const rand = mulberry32(20260926);
  const cell = S / 7;
  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 7; gx++) {
      if (rand() < 0.12) continue; // 留出部分裸板
      const cx = gx * cell + cell * (0.25 + rand() * 0.5);
      const cy = gy * cell + cell * (0.25 + rand() * 0.5);
      drawFlake(g, cx, cy, cell * (0.26 + rand() * 0.18), rand);
    }
  }
  shared = new THREE.CanvasTexture(c);
  shared.colorSpace = THREE.SRGBColorSpace;
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.anisotropy = 8;
  return shared;
}
