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
    lines[id] = l;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'dim-label');
    svg.appendChild(t);
    labels[id] = { text: t, bg: null };
  }
  ['w', 'h', 'd'].forEach(makeLine);

  const v = new THREE.Vector3();

  function project(p3) {
    v.copy(p3).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
      z: v.z,
    };
  }

  function setLine(id, a, b, text) {
    const l = lines[id];
    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
    l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const t = labels[id].text;
    t.textContent = text;
    const pad = 4;
    const w = text.length * 7 + pad * 2;
    t.setAttribute('x', mx); t.setAttribute('y', my + 4);
    t.setAttribute('text-anchor', 'middle');
    let bg = labels[id].bg;
    if (!bg) {
      bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('class', 'dim-label-bg');
      svg.insertBefore(bg, t);
      labels[id].bg = bg;
    }
    bg.setAttribute('x', mx - w / 2); bg.setAttribute('y', my - 10);
    bg.setAttribute('width', w); bg.setAttribute('height', 20);
  }

  function fade(id, opacity) {
    lines[id].style.opacity = opacity;
    labels[id].text.style.opacity = opacity;
    if (labels[id].bg) labels[id].bg.style.opacity = opacity;
  }

  function update(bounds, center) {
    const { W, H, D } = bounds;
    const y0 = 0;
    const xL = center.x - W / 2, xR = center.x + W / 2;
    const zF = center.z + D / 2, zB = center.z - D / 2;

    // 总宽：前底部
    const a1 = project(new THREE.Vector3(xL, y0, zF + 0.06));
    const a2 = project(new THREE.Vector3(xR, y0, zF + 0.06));
    setLine('w', a1, a2, W.toFixed(2) + ' m');
    // 总高：左缘
    const b1 = project(new THREE.Vector3(xL - 0.10, 0, zF));
    const b2 = project(new THREE.Vector3(xL - 0.10, H, zF));
    setLine('h', b1, b2, H.toFixed(2) + ' m');
    // 总深：右缘
    const c1 = project(new THREE.Vector3(xR + 0.10, 0.02, zF));
    const c2 = project(new THREE.Vector3(xR + 0.10, 0.02, zB));
    setLine('d', c1, c2, D.toFixed(2) + ' m');

    // 相机背向或过近时淡出
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const camPos = camera.position;
    for (const [id, p3] of [
      ['w', new THREE.Vector3(0, y0, zF + 0.06)],
      ['h', new THREE.Vector3(xL - 0.10, H / 2, zF)],
      ['d', new THREE.Vector3(xR + 0.10, 0.02, center.z)],
    ]) {
      const s = project(p3);
      const behind = s.z > 1;
      const near = camPos.distanceTo(p3) < 0.5;
      fade(id, behind || near ? 0 : 1);
    }
  }

  return { update };
}
