// 算料单导出：支持型材架（product.js）与光轴展架（rodrack.js）两种配置
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cell(v, style = '') {
  const t = typeof v === 'number' ? 'Number' : 'String';
  return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${t}">${esc(v)}</Data></Cell>`;
}
function row(cells, style = '') {
  return `<Row>${cells.map(c => cell(c, style)).join('')}</Row>`;
}

/**
 * 生成算料单 .xls 文件内容（统一入口，按 kind 分派）
 * @param {'profile'|'rod'} kind
 */
export function buildCutlistWorkbook(cfg, stats, kind = 'profile') {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const totalCutLen = stats.cutList.reduce((a, c) => a + c.len * c.qty, 0);

  let title, configLine, hwRows, extraStats, wText, hText;
  if (kind === 'crates') {
    const { CRATE_SCHEMES } = window.__ALU_LABELS.crates;
    title = '周转箱收纳架 · 算料单';
    const tags = [];
    if (cfg.casters) tags.push('滚轮');
    if (cfg.pullOut) tags.push('抽拉展示');
    configLine = `${cfg.tiers} 层 · 宽 ${cfg.width.toFixed(2)} m · 深 ${cfg.depth.toFixed(2)} m · ${CRATE_SCHEMES[cfg.scheme].label}配色`;
    hwRows = [
      ['序号', '五金名称', '数量', '单位'],
      ...stats.hardware.map((h, idx) => [idx + 1, h.name, h.qty, "件"]),
    ];
    extraStats = [];
    wText = (cfg.width + 0.06).toFixed(2);
    hText = (cfg.height + 0.20).toFixed(2);
  } else if (kind === 'woodcart') {
    const { WOOD_TONES } = window.__ALU_LABELS.woodcart;
    title = '光轴木展车 · 算料单';
    const tags = [];
    if (cfg.pegboard) tags.push('洞洞板');
    if (cfg.topRail) tags.push('顶挂杆');
    if (cfg.sideRail) tags.push('侧挂杆');
    if (cfg.casters) tags.push('滚轮');
    configLine = `宽 ${cfg.width.toFixed(2)} m · 高 ${cfg.height.toFixed(2)} m · ${cfg.shelves} 层板 · ${WOOD_TONES[cfg.woodTone].label} · ${tags.join(' / ')}`;
    hwRows = [
      ['序号', '五金名称', '数量', '单位'],
      ...stats.hardware.map((h, idx) => [idx + 1, h.name, h.qty, '件']),
    ];
    extraStats = [];
    wText = (cfg.width + 0.06).toFixed(2);
    hText = (cfg.height + 0.06).toFixed(2);
  } else if (kind === 'cart') {
    const { ACRYLIC_TYPES, WOOD_FINISHES } = window.__ALU_LABELS.cart;
    title = '移动边几 · 算料单';
    const tags = [];
    if (cfg.glassTop) tags.push('玻璃台面');
    if (cfg.midAcrylic !== 'none') tags.push(ACRYLIC_TYPES[cfg.midAcrylic].label);
    if (cfg.rodRails) tags.push('光轴挂杆');
    if (cfg.casters) tags.push('滚轮');
    configLine = `宽 ${cfg.width.toFixed(2)} m · 深 ${cfg.depth.toFixed(2)} m · 高 ${cfg.height.toFixed(2)} m · ${WOOD_FINISHES[cfg.woodFinish].label} · ${tags.join(' / ')}`;
    hwRows = [
      ['序号', '五金名称', '数量', '单位'],
      ...stats.hardware.map((h, idx) => [idx + 1, h.name, h.qty, '件']),
    ];
    extraStats = [];
    wText = (cfg.width + 0.06).toFixed(2);
    hText = (cfg.height + 0.16).toFixed(2);
  } else if (kind === 'rod') {
    const { BACK_TYPES, SHELF_TYPES, ROD_COLORS } = window.__ALU_LABELS.rodrack;
    title = '光轴展架 · 算料单';
    const tags = [BACK_TYPES[cfg.backPanel].label];
    if (cfg.shelf && cfg.shelf !== 'none') tags.push(SHELF_TYPES[cfg.shelf].label);
    if (cfg.casters) tags.push('滚轮');
    configLine = `柱距 ${cfg.width.toFixed(2)} m · 柱长 ${cfg.height.toFixed(2)} m · ${tags.join(' / ')} · ${ROD_COLORS[cfg.color].label}`;
    hwRows = [
      ['序号', '五金名称', '数量', '单位'],
      ...stats.hardware.map((h, idx) => [idx + 1, h.name, h.qty, '件']),
    ];
    extraStats = [];
    wText = (cfg.width + 0.12).toFixed(2);
    hText = '1.36';
  } else {
    const { PROFILE_SERIES, DECK_TYPES, COLORS } = window.__ALU_LABELS.product;
    let deckSummary = {};
    for (const d of cfg.decks) deckSummary[d] = (deckSummary[d] || 0) + 1;
    const deckText = Object.entries(deckSummary).map(([k, n]) => `${DECK_TYPES[k].label}×${n}层`).join('，');
    title = '工业铝型材置物架 · 算料单';
    configLine = `${cfg.bays} 跨 × ${cfg.levels} 层 · ${PROFILE_SERIES[cfg.series].label} · 层板 ${deckText || '无'} · 侧挡板 ${cfg.sidePanels ? '有' : '无'} · ${COLORS[cfg.color].label}`;
    hwRows = [
      ['序号', '五金名称', '数量', '单位'],
      ...stats.hardware.map((h, idx) => [idx + 1, h.name, h.qty, '件']),
    ];
    extraStats = [['板条总长', +(stats.stripLengthM || 0).toFixed(1), 'm']];
    wText = cfg.bayWidths ? cfg.bayWidths.reduce((a, b) => a + b, 0).toFixed(2) : '';
    hText = (cfg.levels * 0.45 + 0.05).toFixed(2);
  }

  const cutRows = [
    ['序号', '名称', '规格', '名义尺寸（m）', '下料长度', '数量', '单位'],
    ...stats.cutList.map((c, idx) => [idx + 1, c.spec, c.section, c.span ?? c.len, c.len, c.qty, c.section === '板' ? '块' : '根']),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Microsoft YaHei" ss:Size="10"/><Alignment ss:Vertical="Center"/></Style>
 <Style ss:ID="h1"><Font ss:FontName="Microsoft YaHei" ss:Size="14" ss:Bold="1"/></Style>
 <Style ss:ID="th"><Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#EFEFEF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
 <Style ss:ID="lbl"><Font ss:FontName="Microsoft YaHei" ss:Size="10" ss:Bold="1"/></Style>
 <Style ss:ID="note"><Font ss:FontName="Microsoft YaHei" ss:Size="9" ss:Color="#777777"/></Style>
</Styles>
<Worksheet ss:Name="算料单">
<Table>
${row([title], 'h1')}
${row([configLine])}
${row(['总宽 ' + wText + ' m · 总高 ' + hText + ' m · 导出 ' + stamp])}
${row(['数据性质：配置器演示示例，下料前请以工程图复核'], 'note')}
<Row></Row>
${row(['一、下料清单'], 'lbl')}
${cutRows.map((r, idx) => row(r, idx === 0 ? 'th' : '')).join('\n')}
${row(['合计', '', '', '总下料长度', +totalCutLen.toFixed(1), '', 'm'])}
<Row></Row>
${row(['二、五金配件清单'], 'lbl')}
${hwRows.map((r, idx) => row(r, idx === 0 ? 'th' : '')).join('\n')}
<Row></Row>
${row(['三、统计'], 'lbl')}
${row(['主材总长', +stats.profileLengthM.toFixed(1), 'm'])}
${extraStats.map(r => row(r)).join('\n')}
${row(['估算自重', +stats.weightKg.toFixed(1), 'kg'])}
${row(['零件总数', stats.partCount, '件'])}
<Row></Row>
${row(['注：长度为未验证装配假设的演示结果，非加工指令；需卖家确认节点与公差后重新出图。'], 'note')}
</Table>
</Worksheet>
</Workbook>`;
  return xml;
}

/** 触发浏览器下载（kind: 'profile' | 'rod'）。SpreadsheetML 内容配 .xml 后缀，
 *  Excel / WPS 直接打开且无"格式与扩展名不匹配"警告。 */
export function downloadCutlist(cfg, stats, kind = 'profile') {
  const xml = buildCutlistWorkbook(cfg, stats, kind);
  const blob = new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = kind === 'woodcart' ? `光轴木展车算料单.xml` : kind === 'crates' ? \u5468\u8f6c\u7bb1\u6536\u7eb3\u67b6\u7b97\u6599\u5355_层.xml : kind === 'cart' ? `移动边几算料单_${cfg.width.toFixed(2)}m.xml` : kind === 'rod' ? `光轴展架算料单_${cfg.width.toFixed(2)}m.xml` : `铝型材置物架算料单_${cfg.bays}x${cfg.levels}.xml`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
