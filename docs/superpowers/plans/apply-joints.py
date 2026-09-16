from pathlib import Path
p=Path('src/core/materials.js');s=p.read_text(encoding='utf-8');s+='\n/** Saw-cut face, independent of anodized color. */\nexport function getCutMaterial(){return new THREE.MeshStandardMaterial({color:0xd4d8dc,roughness:.64,metalness:.82});}\n';p.write_text(s,encoding='utf-8')
p=Path('src/core/buildshelf.js');s=p.read_text(encoding='utf-8')
s=s.replace('// 全部 InstancedMesh，整机 draw call ≤ 12','// Instanced detail groups; cap/side materials add draw calls.')
s=s.replace('getAluMaterial, getConnectorMaterial','getCutMaterial, getAluMaterial, getConnectorMaterial')
s=s.replace('const CONN_MASS',"import {makeCornerGeo, makeSocketBoltGeo, makeWasherGeo} from './joints.js';\n\nconst CONN_MASS")
s=s.replace('const matAlu = getAluMaterial(color).clone();','const matAlu = [getCutMaterial(), getAluMaterial(color).clone()];')
a=s.index('  // 2040 横梁');b=s.index('  const beamGeo',a);s=s[:a]+'  // Verified vertices: centered X length; Y remains vertical, section X maps to -Z.\n'+s[b:]
s=s.replace('const boltGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.006, 12);','const boltGeo = makeSocketBoltGeo();\n  const washerGeo = makeWasherGeo();')
s=s.replace('_s.set(wSeg, 1, 1);','_s.set(beamCutLength(wSeg, postProf.w), 1, 1);',1).replace('_s.set(w, 1, 1);','_s.set(beamCutLength(w, postProf.w), 1, 1);',1)
s=s.replace('makeTSlotShape(prof.w, prof.h), sideLen, 8','makeTSlotShape(prof.w, prof.h), sideLen - 2 * JOINT_GAP, 8').replace('px, y, -sideLen / 2','px, y, -sideLen / 2 + JOINT_GAP')
s=s.replace('const paneCells = [];','const paneCells = [];\n  const padRows = [];\n  const PAD_H = .003;')
s=s.replace('beamTop + PANE_THICKNESS / 2, wSeg - 0.03','beamTop + PAD_H + PANE_THICKNESS / 2, wSeg - 0.012')
s=s.replace('paneCells.push([bx + wSeg / 2, beamTop + PAD_H + PANE_THICKNESS / 2, wSeg - 0.012]);','paneCells.push([bx + wSeg / 2, beamTop + PAD_H + PANE_THICKNESS / 2, wSeg - 0.012]);\n        for(const px of [bx+.006,bx+wSeg-.006]) for(const z of [-.15,.15]) padRows.push([px,beamTop+PAD_H/2,z]);')
s=s.replace('deckTopYs.push(beamTop + PANE_THICKNESS);','deckTopYs.push(beamTop + PAD_H + PANE_THICKNESS);')
s=s.replace('  groups.pane = paneMesh;','  groups.pane = paneMesh;\n  const pads=instanced(new THREE.BoxGeometry(.008,PAD_H,.025),matFoot,padRows.length);\n  padRows.forEach(([x,y,z],i)=>setMT(i,pads,x,y,z));\n  groups.pads=pads;')
a=s.index('  const conn = instanced');b=s.index('  // ---- 悬挑托架',a)
s=s[:a]+'''  // Actual beam-end visual nodes; legacy nNodes procurement accounting stays unchanged.
  const nodeRows=[];
  for(let k=0;k<=levels;k++) {
    let bx=x0;
    for(let b=0;b<bays;b++) {
      for(const z of [-zPost,...(k===levels || decks[k]!=='none' ? [zPost] : [])]) {
        nodeRows.push([bx+.01,.02+k*LEVEL_PITCH-prof.h/2,z,1]);
        nodeRows.push([bx+bayWidths[b]-.01,.02+k*LEVEL_PITCH-prof.h/2,z,-1]);
      }
      bx+=bayWidths[b];
    }
  }
  const conn=instanced(connGeo,matConn,nodeRows.length);
  const bolts=instanced(boltGeo,matConn,nodeRows.length*2);
  const washers=instanced(washerGeo,matConn,nodeRows.length*2);
  nodeRows.forEach(([x,y,z,dir],ni)=>{
    setMT(ni,conn,x,y,z,0,dir===1?0:Math.PI,0);
    setMT(ni*2,washers,x+dir*.003,y-.014,z,0,dir*Math.PI/2,0);
    setMT(ni*2,bolts,x+dir*.0038,y-.014,z,0,dir*Math.PI/2,0);
    setMT(ni*2+1,washers,x+dir*.015,y-.003,z,Math.PI/2,0,0);
    setMT(ni*2+1,bolts,x+dir*.015,y-.0038,z,Math.PI/2,0,0);
  });
  groups.conn=conn;groups.bolts=bolts;groups.washers=washers;

'''+s[b:]
s=s.replace("['bolts', groups.bolts],","['bolts', groups.bolts],\n    ['washers', groups.washers],\n    ['pads', groups.pads],")
s=s.replace('const paneArea = paneCells.reduce((a, [, , w]) => a + w * paneDepth, 0);','// Preserve baseline procurement area; visual overlap does not alter purchasing.\n  const paneArea = paneCells.reduce((a, [, , w]) => a + (w - .018) * paneDepth, 0);')
s=s.replace('mesh.material.dispose();','for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) mat.dispose();')
s=s[:s.index('/** 压铸角件')]
p.write_text(s,encoding='utf-8')
