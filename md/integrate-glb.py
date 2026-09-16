from pathlib import Path
P=Path(__file__).resolve().parents[1]
def edit(f,a,b):
 p=P/f;s=p.read_text(encoding='utf-8'); assert a in s,(f,a[:80]);p.write_text(s.replace(a,b),encoding='utf-8')
edit('src/config/product.js',"series: '2040',","series: '2040',\n  frameMode: 'standard', // 'standard' | 'glb'：GLB同构装配，价格未知项单独提示")
edit('src/config/product.js',"normalizeConfig({ bays = 3, levels = 3, series = '2040', decks = ['rib','acrylic','rib'],","normalizeConfig({ bays = 3, levels = 3, series = '2040', frameMode = 'standard', decks = ['rib','acrylic','rib'],")
edit('src/config/product.js',"bayWidths, sidePanels: !!sidePanels, props: props !== false, color,","bayWidths, sidePanels: !!sidePanels, props: props !== false, color, frameMode,")
edit('src/ui/panel.js',"import { PROFILE_SERIES, DECK_TYPES, COLORS, DEFAULT_BAY_WIDTH }","import { PROFILE_SERIES, DECK_TYPES, COLORS, DEFAULT_BAY_WIDTH, FRAME_MODES }")
edit('src/ui/panel.js',"  root.append(title, dims, spec, bayBox, levelBox, profileBox, deckBox, bayWBox, sideRow, swatches, priceBlock);","  const frameBox = row('参考装配', FRAME_MODES, 'frameMode');\n  root.append(title, dims, spec, bayBox, levelBox, profileBox, frameBox, deckBox, bayWBox, sideRow, swatches, priceBlock);")
edit('src/ui/panel.js',"    bayBox.querySelector('[data-value]').textContent = c.bays;","    frameBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === c.frameMode));\n    bayBox.querySelector('[data-value]').textContent = c.bays;")
edit('src/config/product.js',"export const COLORS = {","export const FRAME_MODES = {\n  standard: { label: '参数化装配' },\n  glb: { label: 'GLB同构装配' },\n};\n\nexport const COLORS = {")
edit('src/main.js',"import { buildShelf } from './core/buildshelf.js';","import { buildShelf } from './core/buildshelf.js';\nimport { buildGlbFrame } from './core/buildGlbFrame.js';")
edit('src/main.js',"    const built = buildShelf(cfg, cfg.props);","    const built = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, cfg.props);")
edit('src/main.js',"'bays', 'levels', 'series', 'decks', 'bayWidths', 'sidePanels', 'props', 'color'","'bays', 'levels', 'series', 'frameMode', 'decks', 'bayWidths', 'sidePanels', 'props', 'color'")
edit('src/config/market.js',"rules: [","rules: [\n    { id: 'glb-3030', match: /30×30/, price: 0, range: [0, 0], query: '3030工业铝型材' },\n    { id: 'glb-2010', match: /20×10/, price: 0, range: [0, 0], query: '20×10铝材扁条' },")
print('integrated')
