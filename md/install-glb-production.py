from pathlib import Path
P=Path(__file__).resolve().parents[1]
def edit(f,a,b):
 p=P/f;s=p.read_text(encoding='utf-8');assert a in s,(f,a);p.write_text(s.replace(a,b),encoding='utf-8')
edit('src/core/buildGlbFrame.js','return {group,groups,layout,dispose(){','const stats={cutList:[],hardware:[],panes:[],partCount:Object.values(layout.rows).reduce((n,r)=>n+r.length,0),profileLengthM:0,weightKg:0,referenceOnly:true}; const bounds=new THREE.Vector3(layout.W,layout.H,.40); return {group,groups,layout,stats,bounds,dispose(){')
edit('src/config/product.js',"frameMode: 'standard'","frameMode: 'glb'")
edit('src/config/product.js','// 层板类型：',"export const FRAME_MODES = { glb: { label: 'GLB 精确节点' }, standard: { label: '标准参数架' } };\n\n// 层板类型：")
edit('src/main.js',"import { buildShelf } from './core/buildShelf.js';","import { buildShelf } from './core/buildShelf.js';\nimport { buildGlbFrame } from './core/buildGlbFrame.js';")
edit('src/main.js',"['bays', 'levels', 'series', 'decks', 'bayWidths', 'sidePanels', 'props', 'color']","['bays', 'levels', 'series', 'frameMode', 'decks', 'bayWidths', 'sidePanels', 'props', 'color']")
edit('src/main.js','current = buildShelf(cfg, cfg.props);',"current = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, cfg.props);")
edit('src/main.js','const b = buildShelf(cfg, false);',"const b = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, false);")
# panel imports and selector
edit('src/ui/panel.js',"import { PROFILE_SERIES, DECK_TYPES, COLORS, DEFAULT_BAY_WIDTH } from '../config/product.js';","import { PROFILE_SERIES, DECK_TYPES, COLORS, FRAME_MODES, DEFAULT_BAY_WIDTH } from '../config/product.js';")
edit('src/ui/panel.js',"  const profileBox = row('型材系列 PROFILE', PROFILE_SERIES, 'series');","  const profileBox = row('型材系列 PROFILE', PROFILE_SERIES, 'series');\n  const frameBox = row('装配模型 ASSEMBLY', FRAME_MODES, 'frameMode');")
edit('src/ui/panel.js','root.append(title, dims, spec, bayBox, levelBox, profileBox, deckBox, bayWBox, sideRow, swatches, priceBlock);','root.append(title, dims, spec, bayBox, levelBox, profileBox, frameBox, deckBox, bayWBox, sideRow, swatches, priceBlock);')
edit('src/ui/panel.js',"    profileBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === c.series));","    profileBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === c.series));\n    frameBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === c.frameMode));")
print('installed GLB production integration')
