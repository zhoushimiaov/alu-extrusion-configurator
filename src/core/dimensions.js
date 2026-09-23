// SVG 尺寸标注：总宽（前底）/ 总高（左）/ 总深（右），3D 锚点每帧重投影
import * as THREE from 'three';

const NS = 'http://www.w3.org/2000/svg';

export function createDimensions(svg, camera, renderer) {
  const anchors = { w: [], h: [], d: [] };
  const lines = {};
  const labels = {};

  function makeLine(id) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('class', 'dim-line');
    svg.appendChild(l);
    lines[id] = { line: l, ticks: [null, null] };
    // 端部圆点收口（极简标注特征）：每条尺寸线两端各一枚实心圆点
    for (let k = 0; k < 2; k++) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'dim-dot');
      dot.setAttribute('r', '3');
      svg.appendChild(dot);
      lines[id].ticks[k] = dot;
    }
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'dim-label');
    svg.appendChild(t);
    labels[id] = { text: t, bg: null };
  }
  ['w', 'h', 'd'].forEach(makeLine);

  const v = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  // 预分配锚点向量，避免每帧 new（update 在渲染循环热路径上）
  const _a1 = new THREE.Vector3(), _a2 = new THREE.Vector3();
  const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3();
  const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
  const _pw = new THREE.Vector3(), _ph = new THREE.Vector3(), _pd = new THREE.Vector3();

  function project(p3) {
    v.copy(p3).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
      z: v.z,
    };
  }

  // 端部圆点直接落在尺寸线端点上（圆心即端点，视觉即“测量点”）
  function setLine(id, a, b, text) {
    const { line: l, ticks } = lines[id];
    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
    l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);

    const ends = [a, b];
    for (let k = 0; k < 2; k++) {
      ticks[k].setAttribute('cx', ends[k].x);
      ticks[k].setAttribute('cy', ends[k].y);
    }

    // 数字压线：白底胶囊托底，文字居中压在线上
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const t = labels[id].text;
    t.textContent = text;
    const pad = 9;
    const w = text.length * 8.2 + pad * 2;
    t.setAttribute('x', mx); t.setAttribute('y', my + 4.5);
    t.setAttribute('text-anchor', 'middle');
    let bg = labels[id].bg;
    if (!bg) {
      bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('class', 'dim-label-bg');
      bg.setAttribute('rx', '10');
      svg.insertBefore(bg, t);
      labels[id].bg = bg;
    }
    bg.setAttribute('x', mx - w / 2); bg.setAttribute('y', my - 10);
    bg.setAttribute('width', w); bg.setAttribute('height', 20);
  }

  function fade(id, opacity) {
    const { line, ticks } = lines[id];
    line.style.opacity = opacity;
    for (const tk of ticks) tk.style.opacity = opacity;
    labels[id].text.style.opacity = opacity;
    if (labels[id].bg) labels[id].bg.style.opacity = opacity;
  }

  function update(bounds, center) {
    const { W, H, D } = bounds;
    const y0 = 0;
    const xL = center.x - W / 2, xR = center.x + W / 2;
    const zF = center.z + D / 2, zB = center.z - D / 2;
    // 窄屏（移动端）：右下是按钮条，深度标注锚点往模型内侧收，避开按钮
    const narrow = renderer.domElement.getBoundingClientRect().width < 620;
    const dOff = narrow ? -0.04 : 0.10;

    // 总宽：前底部
    const a1 = project(_a1.set(xL, y0, zF + 0.06));
    const a2 = project(_a2.set(xR, y0, zF + 0.06));
    setLine('w', a1, a2, W.toFixed(2) + ' m');
    // 总高：左缘
    const b1 = project(_b1.set(xL - 0.10, 0, zF));
    const b2 = project(_b2.set(xL - 0.10, H, zF));
    setLine('h', b1, b2, H.toFixed(2) + ' m');
    // 总深：右缘（窄屏往内收）
    const c1 = project(_c1.set(xR + dOff, 0.02, zF));
    const c2 = project(_c2.set(xR + dOff, 0.02, zB));
    setLine('d', c1, c2, D.toFixed(2) + ' m');

    // 相机背向或过近时淡出
    camera.getWorldDirection(camDir);
    const camPos = camera.position;
    for (const [id, p3] of [
      ['w', _pw.set(0, y0, zF + 0.06)],
      ['h', _ph.set(xL - 0.10, H / 2, zF)],
      ['d', _pd.set(xR + dOff, 0.02, center.z)],
    ]) {
      const s = project(p3);
      const behind = s.z > 1;
      const near = camPos.distanceTo(p3) < 0.5;
      fade(id, behind || near ? 0 : 1);
    }
  }

  return { update };
}
