// MEKIT 采购清单 — 真正的 Office Open XML .xlsx（无需第三方库）及 UTF-8 CSV。
// 显示层按真实 cutList / hardware / panes 合并，不会假造板件未知的深度、厚度或采购单价。
const HEADERS = ['类别','零件名称','规格','长(m)','宽(m)','厚(m)','单位','数量','所属产品','备注'];
const enc = new TextEncoder();
const escapeXml = str => String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const round = n => Number.isFinite(n) ? +n.toFixed(4) : '';
const productName = (kind,cfg) => ({
  profile:'铝型材置物架',rod:'光轴展架',cart:'移动边几',crates:'周转箱架',
  woodcart:'光轴木展车',hanger:'挂衣架',books:cfg?.style==='table'?'阅读长桌':'展示杂志架',
  sheet:'镀锌板书架',table:'阅读长桌',
})[kind] || kind;

export function buildPurchaseRows(stats,kind='profile',cfg={}) {
  if (!stats?.cutList || !stats?.hardware) throw new TypeError('采购清单需要完整模型 BOM 数据');
  const product=productName(kind,cfg), details=[];
  for (const part of stats.cutList) {
    const qty = Math.max(0,Math.trunc(Number(part.qty)||0)); if (!qty) continue;
    const isBoard = part.section === '板';
    const name = String(part.spec||'未命名零件');
    const section=String(part.section || '');
    const length=round(Number(part.len));
    const width=part.width!=null ? round(Number(part.width)) : '';
    const thick=part.thickness!=null ? round(Number(part.thickness)) : '';
    details.push([isBoard?'板件':'型材/光轴/钢索',name,section,length,width,thick,isBoard?'块':'根',qty,product,
      isBoard && (width===''||thick==='') ? '板宽/板厚待图纸复核，勿直接据此裁切' : '尺寸需工程复核']);
  }
  for (const h of stats.hardware) {
    const qty=Math.max(0,Math.trunc(Number(h.qty)||0)); if(!qty)continue;
    details.push(['五金/配件',String(h.name||'未命名五金'),'','','','','件',qty,product,'型号及连接件需采购复核']);
  }
  const normalizePanelName = value => String(value)
    .replace(/[（(]([^）)]*)[）)]/g,'$1')
    .replace(/\s+/g,'')
    .replace(/[^\p{L}\p{N}]/gu,'')
    .toLowerCase();
  const namedBoards=new Set(details.filter(x=>x[0]==='板件').map(x=>normalizePanelName(x[1])));
  for(const p of stats.panes||[]){
    const label=String(p.label||'板面材料');
    // panes 是面积报价项，不得把“玻璃副层板 8mm”和“玻璃副层板（8mm）”当两份采购。
    if(namedBoards.has(normalizePanelName(label)))continue;
    const area=round(Number(p.areaM2));
    if(!Number.isFinite(area))continue;
    details.push(['板材/面材',label,p.kind||'','','','','㎡',area,product,'按面积核价；切割尺寸及片数待工程图确定']);
  }
  const merged=new Map();
  for(const row of details){
    const key=row.filter((_,i)=>i!==7).join('\u0001');
    if(merged.has(key))merged.get(key)[7]+=row[7]; else merged.set(key,[...row]);
  }
  return {headers:HEADERS, summary:[...merged.values()], detail:details};
}

function csvCell(v) {
  let s=String(v??'');
  // CSV injection: prevent formula evaluation when opened in Excel/WPS.
  if (/^[=+@\-\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export function purchaseCsv(stats,kind,cfg,mode='summary'){
  const r=buildPurchaseRows(stats,kind,cfg);
  return '\ufeff'+[r.headers,...(mode==='detail'?r.detail:r.summary)]
    .map(row=>row.map(csvCell).join(',')).join('\r\n');
}
function u16(v){return [v&255,v>>>8&255];}
function u32(v){return [v&255,v>>>8&255,v>>>16&255,v>>>24&255];}
function crc32(data){
  let c=0xffffffff;
  for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1) ^ (c&1?0xedb88320:0);}
  return (c^0xffffffff)>>>0;
}
function concat(chunks){let n=0;for(const x of chunks)n+=x.length;const result=new Uint8Array(n);let off=0;for(const x of chunks){result.set(x,off);off+=x.length;}return result;}
const bytes=a=>Uint8Array.from(a);
function zipFiles(files){
  const local=[],central=[];let offset=0;const count=files.length;
  for(const [name,content] of files){
    const path=enc.encode(name),data=enc.encode(content),crc=crc32(data);
    const common=[...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(path.length),...u16(0)];
    const record=concat([bytes([...u32(0x04034b50),...common]),path,data]);local.push(record);
    central.push(concat([bytes([...u32(0x02014b50),...u16(20),...common,...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),path]));
    offset+=record.length;
  }
  const dir=concat(central);
  return concat([...local,dir,bytes([...u32(0x06054b50),...u16(0),...u16(0),...u16(count),...u16(count),...u32(dir.length),...u32(offset),...u16(0)])]);
}
function sheetXml(headers,data){
  const rows=[headers,...data].map((row,ri)=>{
    const cells=row.map((v,ci)=>{
      const col=String.fromCharCode(65+ci),id=col+(ri+1);
      if(typeof v==='number'&&Number.isFinite(v))return `<c r="${id}"><v>${v}</v></c>`;
      return `<c r="${id}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri+1}">${cells}</row>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>'+rows+'</sheetData></worksheet>';
}
export function purchaseXlsx(stats,kind,cfg){
  const {headers,summary,detail}=buildPurchaseRows(stats,kind,cfg);
  return zipFiles([
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?>'+
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
      '<Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?>'+
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
      '<sheets><sheet name="采购汇总" sheetId="1" r:id="rId1"/><sheet name="逐件明细" sheetId="2" r:id="rId2"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml',sheetXml(headers,summary)],
    ['xl/worksheets/sheet2.xml',sheetXml(headers,detail)],
  ]);
}
