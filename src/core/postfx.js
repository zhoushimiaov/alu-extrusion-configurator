// 后期处理链：渲染 → 色调映射输出 → 轻量暗角
// 全程序化无外部资产。GTAO 曾破坏 transmission 背景采样（黑色半透板），已移除；
// 需要对照实验时从 git 历史取回（勿留运行时开关，全体用户为其付下载成本）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
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
    if (typeof window !== 'undefined') window.__ALU_FX = { mode: 'passthrough', reason: NO_FX ? 'nofx' : 'software-gl' };
    return { render() { renderer.render(scene, camera); }, setSize() {} };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x / renderer.getPixelRatio(), size.y / renderer.getPixelRatio());

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(VignetteShader));

  if (typeof window !== 'undefined') window.__ALU_FX = { mode: 'composer' };

  return {
    render() { composer.render(); },
    setSize(w, h) {
      composer.setSize(w, h);
    },
  };
}
