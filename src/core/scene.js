// 场景 / 相机 / 灯光 / 环境 / 地面 / 阴影
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 程序化摄影棚环境：顶部柔光箱 + 双侧后竖条（金属条状高光）+ 正面弱补光
function buildStudioEnv(renderer) {
  const env = new THREE.Scene();
  // 中亮灰底：基础辐照接近亮棚（非金属/槽口不发黑），亮面片负责方向性高光
  env.background = new THREE.Color(0x8a8f96);
  const add = (w, h, intensity, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 1, 0);
    env.add(m);
    return m;
  };
  add(6, 3.5, 3.2, [0, 5.5, 0.5]);        // 顶部主柔光箱
  add(0.7, 4.5, 7.0, [-4.5, 2.2, -3.0]);  // 左后竖条：拉丝铝 / 镀铬的方向性长高光
  add(0.7, 4.0, 3.2, [4.2, 2.0, -2.8]);   // 右后竖条（弱，补轮廓）
  add(5, 2.5, 1.5, [0, 1.6, 5.5]);        // 正面大面积补光（镀铬立柱主反射源）
  add(7, 3, 1.1, [-5, 1.4, 2.5]);         // 左侧环境补光
  add(7, 3, 0.9, [5, 1.4, 2.0]);          // 右侧环境补光
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

// 浅色渐变幕布背景。ACES（three 用 Hill 拟合，灰度标量形式含 exposure/0.6 前因子）
// 会把亮灰背景压灰：这里按期望输出 sRGB 色反算纹理应填的色值（中性灰，单通道求解），
// 配合 scene.backgroundIntensity 使用；屏幕输出精确回到设计值。
const TONE_EXPOSURE = 1.05;      // 与 createScene 里 renderer.toneMappingExposure 保持一致
const TONE_INTENSITY = 5;        // 与 scene.backgroundIntensity 保持一致
function acesFit(v) {            // three: RRTAndODTFit（灰度标量；输入/输出矩阵行和均为 1，中性色不变）
  return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
}
function srgbToLinear(u) { return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }
function linearToSrgb(v) { return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
function acesCompensate(hex) {
  const n = parseInt(hex.slice(1), 16);
  const targetLinear = srgbToLinear(((n >> 16) & 255) / 255); // 中性灰渐变：取 R 通道即可
  let lo = 0, hi = 1;            // 纹理通道值域 [0,1]
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (acesFit(mid * TONE_INTENSITY * TONE_EXPOSURE / 0.6) < targetLinear) lo = mid; else hi = mid;
  }
  const s = Math.round(linearToSrgb((lo + hi) / 2) * 255);
  return `rgb(${s},${s},${s})`;
}
function makeBackdropTexture() {
  const stops = ['#fbfbfc', '#eef0f2', '#dde1e6'];
  const c = document.createElement('canvas');
  c.width = 16; c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  for (let i = 0; i < stops.length; i++) grad.addColorStop(i / (stops.length - 1), acesCompensate(stops[i]));
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // 阴影已按用户要求关闭（软阴影观感不被接受）：不再创建阴影贴图
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = makeBackdropTexture();
  // ACES 会把亮灰背景压灰（白纹理输出仅 ≈#e4e6e9）。提高 backgroundIntensity 只影响
  // 背景一层（模型照常），配合下方按 three 真实 ACES（Hill 拟合）反算的纹理色值，
  // 屏幕输出精确回到设计值 #fbfbfc / #eef0f2 / #dde1e6（截图采样验证）。
  scene.backgroundIntensity = 5;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 60);
  camera.position.set(3.4, 2.0, 4.2);

  // 环境光照（程序化摄影棚 PMREM）
  scene.environment = buildStudioEnv(renderer);

  // 主光（方向性，不投影）+ 冷色轮廓光
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 7, 3);
  key.castShadow = false;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0xdfe8f5, 0.45); // 近中性轮廓光：饱和天蓝会把银色型材压成蓝灰塑料感
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  // 地面：仅保留光池网格（阴影承接层随阴影一起移除）
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ map: makePoolTexture(), transparent: true, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.001;
  pool.renderOrder = 2;
  scene.add(pool);

  // 控制器：左键旋转 / 右键平移 / 滚轮缩放（用户指定）
  const controls = new OrbitControls(camera, canvas);
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.12;
  controls.maxDistance = 14;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 2.8;
  controls.enablePan = true;
  controls.maxPan = undefined;
  controls.target.set(0, 1.1, 0);
  controls.autoRotateSpeed = 1.2;

  // 阴影已关闭：保留 fitShadow 接口为轻量实现（仅按产品高度微调主光位置），避免改动调用方
  function fitShadow(b) {
    const keyDir = key.position.clone().normalize();
    key.position.copy(keyDir).multiplyScalar(b.H * 0.6 + 6);
    key.target.position.set(0, Math.min(b.H * 0.4, 1.2), 0);
    key.target.updateMatrixWorld();
  }
  fitShadow({ W: 3.4, H: 2.3, D: 0.6 });

  function resize() {
    const el = canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function makePoolTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 2048;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(1024, 1024, 80, 1024, 1024, 1000);
    grad.addColorStop(0, 'rgba(40,44,52,0.10)');
    grad.addColorStop(0.55, 'rgba(40,44,52,0.04)');
    grad.addColorStop(1, 'rgba(40,44,52,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 2048);
    // 两级制图网格：0.1 m 细格 + 0.5 m 主格（14 m 平面）。旧版一格 0.875 m，
    // 与任何产品模数无关且比小产品还粗；mipmap 让细格随距离自然淡出。
    const pxPerM = 2048 / 14;
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(20,22,26,0.05)';
    for (let p = 0; p <= 2048; p += 0.1 * pxPerM) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 2048); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(2048, p); g.stroke();
    }
    g.strokeStyle = 'rgba(20,22,26,0.10)';
    for (let p = 0; p <= 2048; p += 0.5 * pxPerM) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 2048); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(2048, p); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  return { renderer, scene, camera, controls, key, fitShadow };
}
