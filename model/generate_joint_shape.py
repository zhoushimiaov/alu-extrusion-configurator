import json
from pathlib import Path
d=json.load(open(Path(__file__).with_name('joint-profile.json'),encoding='utf-8'))
loops=d['loops']; allp=[p for L in loops for p in L['points']];cx=(min(p[0] for p in allp)+max(p[0] for p in allp))/2;cy=(min(p[1] for p in allp)+max(p[1] for p in allp))/2
def norm(L):return [[round(p[0]-cx,6),round(p[1]-cy,6)] for p in L['points']]
def area(P):return sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P)))/2
outer=norm(loops[0]); holes=[norm(L) for L in loops[1:]]
# THREE winding: enforce outer CCW, holes CW.
if area(outer)<0:outer.reverse()
for h in holes:
 if area(h)>0:h.reverse()
def js(a):return json.dumps(a,separators=(',',':'))
fn=f'''/** Exact 30×30 depth-beam section from alu-frame.glb mesh 10 end cap. */
export function makeGlbJointShape() {{
  const outer={js(outer)};
  const holes={js(holes)};
  const s=new THREE.Shape(); outer.forEach((q,i)=>i?s.lineTo(q[0],q[1]):s.moveTo(q[0],q[1])); s.closePath();
  for(const ring of holes){{const h=new THREE.Path();ring.forEach((q,i)=>i?h.lineTo(q[0],q[1]):h.moveTo(q[0],q[1]));h.closePath();s.holes.push(h);}}
  return s;
}}

'''
p=Path(__file__).parents[1]/'src/core/profiles.js';s=p.read_text(encoding='utf-8');marker='/**\n * alu-frame.glb mesh 7 精确端盖截面';assert marker in s;p.write_text(s.replace(marker,fn+marker),encoding='utf-8');print('generated',len(outer),list(map(len,holes)),cx,cy)
