// 镀锌板锌花（spangle）程序化纹理——对照实拍镀锌铁皮：
//   满铺不规则结晶片（无裸板），片形尖锐呈叶片 / 碎片状、边缘直线段锯齿，片内若干解理面明暗不同，
//   片间无描边、仅靠灰度区分；整体中灰、低对比，无彩色。旧版「雪花放射枝」与实物差异大，已替换。
// 算法（全部可无缝平铺）：
//   1) 大尺度值噪声轻扭曲（晶粒不呈规则网格）
//   2) 细 Voronoi 分段位移：每个小胞一个常量位移向量 → 大晶粒边界变成直线段锯齿，出尖角（晶体感的关键；
//      平滑噪声扭曲只能得到圆润色块）
//   3) 主 Voronoi 晶粒：每粒基调灰度（亮片 / 中灰 / 暗片三档）
//   4) 晶内按方位角切 3~5 个解理面，各面独立明暗（直线分界）
//   5) 镀层微颗粒
// 单例纹理：模块级共享，repeat 由使用方按板材尺寸设置（型材架背板约 0.55m 一个 tile → 晶粒约 1.1cm）。
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

// 可平铺值噪声（周期 = 网格数），双线性 + smoothstep
function makeValueNoise(period, rand) {
  const v = new Float32Array(period * period);
  for (let i = 0; i < v.length; i++) v[i] = rand() * 2 - 1;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = v[y0 * period + x0], b = v[y0 * period + x1], c = v[y1 * period + x0], d = v[y1 * period + x1];
    const top = a + (b - a) * sx;
    return top + ((c + (d - c) * sx) - top) * sy;
  };
}

// 可平铺抖动网格 Voronoi：返回 (x,y) 的最近种子索引与相对种子的偏移
function makeVoronoi(G, S, rand, jitter = 0.8) {
  const cell = S / G;
  const sx = new Float32Array(G * G), sy = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) {
    sx[i] = ((i % G) + (1 - jitter) / 2 + rand() * jitter) * cell;
    sy[i] = (((i / G) | 0) + (1 - jitter) / 2 + rand() * jitter) * cell;
  }
  const res = { i: 0, dx: 0, dy: 0 };
  return (x, y) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let d1 = Infinity, best = 0, bdx = 0, bdy = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox, gy = cy + oy;
        const wx = ((gx % G) + G) % G, wy = ((gy % G) + G) % G;
        const i = wy * G + wx;
        const dx = x - (sx[i] + (gx - wx) * cell);
        const dy = y - (sy[i] + (gy - wy) * cell);
        const d = dx * dx + dy * dy;
        if (d < d1) { d1 = d; best = i; bdx = dx; bdy = dy; }
      }
    }
    res.i = best; res.dx = bdx; res.dy = bdy;
    return res;
  };
}

/**
 * 生成锌花像素（灰度 0..255），纯函数便于测试
 * @param S     纹理边长（像素）
 * @param G     每边晶粒数（平均晶粒直径 ≈ S/G 像素）
 * @param seed  随机种子
 */
export function generateSpanglePixels(S = 1024, G = 30, seed = 20261004) {
  const rand = mulberry32(seed);
  const cell = S / G;
  const N = G * G;
  // 晶粒属性
  const tone = new Float32Array(N), facets = new Uint8Array(N), phase = new Float32Array(N);
  const facetTone = new Float32Array(N * 5), tilt = new Float32Array(N), tiltDir = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = rand();
    // 三档：亮片（浅灰）/ 中灰 / 暗片；整体低对比（实拍为中灰调）
    tone[i] = r < 0.28 ? 0.30 + rand() * 0.14 : r > 0.64 ? 0.66 + rand() * 0.20 : 0.46 + rand() * 0.16;
    facets[i] = 3 + Math.floor(rand() * 3);
    phase[i] = rand() * Math.PI * 2;
    tilt[i] = (rand() - 0.5) * 0.16;
    tiltDir[i] = rand() * Math.PI * 2;
    for (let k = 0; k < 5; k++) facetTone[i * 5 + k] = (rand() - 0.5) * 0.30;
  }
  const grains = makeVoronoi(G, S, rand, 0.85);
  // 细 Voronoi 分段位移场（小胞约 1/2.5 晶粒），每胞一个常量位移 → 晶界为较长的直线段锯齿
  const GS = Math.round(G * 2.5);
  const shards = makeVoronoi(GS, S, rand, 0.9);
  const shX = new Float32Array(GS * GS), shY = new Float32Array(GS * GS);
  for (let i = 0; i < GS * GS; i++) { const a = rand() * Math.PI * 2, m = rand(); shX[i] = Math.cos(a) * m; shY[i] = Math.sin(a) * m; }
  // 大尺度轻扭曲 + 微颗粒（周期为整数，采样频率 = 周期 / S → 无缝）
  const PA = Math.max(4, Math.round(G / 3)), PN = Math.max(16, G * 8);
  const warpA = makeValueNoise(PA, rand), warpB = makeValueNoise(PA, rand), grainN = makeValueNoise(PN, rand);
  const kA = PA / S, kN = PN / S;
  const ampA = cell * 0.30, ampS = cell * 0.34;

  const tbuf = new Float32Array(S * S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let qx = px + warpA(px * kA, py * kA) * ampA;
      let qy = py + warpB(px * kA, py * kA) * ampA;
      const sh = shards(qx, qy);
      const si = sh.i;
      qx += shX[si] * ampS;
      qy += shY[si] * ampS;
      const g = grains(qx, qy);
      const b = g.i;
      // 解理面：按方位角切分（直线分界）
      const n = facets[b];
      let ang = Math.atan2(g.dy, g.dx) + phase[b];
      ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const f = Math.floor(ang / (Math.PI * 2 / n)) % n;
      let t = tone[b] + facetTone[b * 5 + f];
      // 面内反光倾角（线性明暗，不画线）
      t += ((g.dx * Math.cos(tiltDir[b]) + g.dy * Math.sin(tiltDir[b])) / cell) * tilt[b];
      t += grainN(px * kN, py * kN) * 0.03;
      tbuf[py * S + px] = t;
    }
  }
  // 灰度标定到实拍镀锌板统计（参考照片实测：均值 133.8 / 标准差 30.2）。标准差取 25：
  //   近看仍是锌花，远看（整架视距）不至于呈花岗岩式斑驳
  let sum = 0, sq = 0;
  for (let i = 0; i < tbuf.length; i++) { sum += tbuf[i]; sq += tbuf[i] * tbuf[i]; }
  const mean = sum / tbuf.length, std = Math.sqrt(Math.max(1e-9, sq / tbuf.length - mean * mean));
  const out = new Uint8ClampedArray(S * S);
  for (let i = 0; i < tbuf.length; i++) out[i] = 138 + ((tbuf[i] - mean) / std) * 25;
  return out;
}

export function getSpangleTexture() {
  if (shared) return shared;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g && typeof g.createImageData === 'function' ? g.createImageData(S, S) : null;
  if (img && img.data) {
    const px = generateSpanglePixels(S);
    const d = img.data;
    for (let i = 0, j = 0; i < px.length; i++, j += 4) {
      // 极轻冷调（镀锌层偏冷灰），不引入彩色
      d[j] = px[i]; d[j + 1] = Math.min(255, px[i] + 2); d[j + 2] = Math.min(255, px[i] + 5); d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  shared = new THREE.CanvasTexture(c);
  shared.colorSpace = THREE.SRGBColorSpace;
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.anisotropy = 8;
  return shared;
}
