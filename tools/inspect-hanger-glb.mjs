// 解析挂衣架 GLB：输出节点层级 + 世界变换（平移/缩放），还原真实装配位置
import { NodeIO } from '@gltf-transform/core';
import { writeFileSync } from 'fs';

const origWarn = console.warn;
console.warn = () => {};
const io = new NodeIO();
const doc = await io.read('model/挂衣架.glb');
console.warn = origWarn;

const root = doc.getRoot();
const scene = root.listScenes()[0];
const out = [];

function mul(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++)
    r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return r;
}
function nodeLocal(n) {
  const t = n.getTranslation(), r = n.getRotation(), s = n.getScale();
  const [x, y, z, w] = r;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
    (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
    (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function walk(node, parentMat, depth) {
  const world = mul(parentMat, nodeLocal(node));
  const t = [world[12], world[13], world[14]];
  const sx = Math.hypot(world[0], world[1], world[2]);
  const sy = Math.hypot(world[4], world[5], world[6]);
  const sz = Math.hypot(world[8], world[9], world[10]);
  const mesh = node.getMesh();
  const meshIdx = mesh ? root.listMeshes().indexOf(mesh) : -1;
  out.push(`${'  '.repeat(depth)}${node.getName() || '(node)'} mesh#${meshIdx} t=[${t.map(v => (v * 0.0254).toFixed(3)).join(',')}]m s=[${sx.toFixed(3)},${sy.toFixed(3)},${sz.toFixed(3)}]`);
  for (const c of node.listChildren()) walk(c, world, depth + 1);
}

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const n of scene.listChildren()) walk(n, I, 0);

writeFileSync('.openclaw/tmp/hanger-glb-tree.txt', out.join('\n'), 'utf8');
console.log(`nodes: ${out.length}, written to .openclaw/tmp/hanger-glb-tree.txt`);