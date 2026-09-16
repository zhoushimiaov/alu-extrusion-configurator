// 后期处理链：渲染 → GTAO 接触遮蔽 → 色调映射输出 → 轻量暗角
// 全程序化无外部资产；GTAO 初始化失败时自动降级为直通渲染
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 浅色主题暗角：只压角部 ~10%，聚拢视线不压氛围
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.11 },
    inner: { value: 0.62 },
    outer: { value: 1.25 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float inner;
    uniform float outer;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float d = length((vUv - 0.5) * vec2(1.18, 1.0));
      float v = smoothstep(inner, outer, d);
      color.rgb *= 1.0 - strength * v;
      gl_FragColor = color;
    }`,
};

// 调试开关：?nofx 完全直通（对照实验 / 低端兜底用）
const NO_FX = typeof location !== 'undefined' && /[?&]nofx/.test(location.search);
// GTAO 默认关闭：实测 GTAO 的深度/法线预渲染会覆盖 transmission 材质采样的背景，
// 使玻璃/亚克力呈黑色半透板。需要对照实验时用 ?ao 手动开启。
const FORCE_AO = typeof location !== 'undefined' && /[?&]ao\b/.test(location.search);

// 软件渲染器下 GTAO 的浮点 RT 会出块状伪影，直接直通。
// 实测 headless QA 环境字符串为 "Microsoft Basic Render Driver"（D3D11 WARP），
// 真机 GPU 为 "ANGLE (NVIDIA/Intel/AMD ...)"，按此匹配不误伤。
function isSoftwareGL(renderer) {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}

export function createPostFX(renderer, scene, camera) {
  if (NO_FX || isSoftwareGL(renderer)) {
    if (typeof window !== 'undefined') window.__ALU_FX = { mode: 'passthrough', gtao: false, reason: NO_FX ? 'nofx' : 'software-gl' };
    return { render() { renderer.render(scene, camera); }, setSize() {} };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x / renderer.getPixelRatio(), size.y / renderer.getPixelRatio());

  composer.addPass(new RenderPass(scene, camera));

  // GTAO 默认关闭（见 FORCE_AO 说明），仅 ?ao 显式开启；软件渲染器下同样跳过
  let gtao = null;
  if (FORCE_AO) try {
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.7;
    // 场景为米级尺度：半径 0.15m，贴细节不糊整体
    gtao.updateGtaoMaterial({ radius: 0.15, distanceExponent: 1.2, thickness: 0.05, distanceFallOff: 1.0, samples: 12 });
    composer.addPass(gtao);
  } catch (err) {
    console.warn('[ALU] GTAO 初始化失败，后期降级为直通渲染', err);
    gtao = null;
  }

  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(VignetteShader));

  if (typeof window !== 'undefined') window.__ALU_FX = { mode: 'composer', gtao: !!gtao };

  return {
    render() { composer.render(); },
    setSize(w, h) {
      composer.setSize(w, h);
      if (gtao) gtao.setSize(w, h);
    },
  };
}
