// 示例价格表：以下单价、区间未经卖家SKU/计价单位核验，不是实时市场报价。
// 更新方式：改 tools/price_table.json（人工核验后）→ wrangler kv key put 写入 → 页面无需重新构建部署。
// 价格只用于比价参考，不构成正式报价。
export const MARKET = {
  updated: '2026-09-05',
  source: '未核验示例单价（淘宝 / 1688 仅为搜索入口）',

  // 型材 / 光轴：按 cutList 的 section（先）或 spec（后）正则匹配，单位元/米
  rules: [
    { id: 'alu-2040', match: /20×40|2040/, price: 16, range: [12, 22], query: '2040工业铝型材' },
    { id: 'alu-2020', match: /20×20|2020/, price: 9, range: [6, 13], query: '2020工业铝型材' },
    { id: 'strip-2416', match: /24×16/, price: 7, range: [5, 10], query: '铝型材层板条' },
    { id: 'strip-2408', match: /24×8/, price: 5, range: [3, 8], query: '铝型材封边条' },
    { id: 'rod-20', match: /⌀20/, price: 22, range: [15, 30], query: '镀铬光轴 直径20' },
    { id: 'rod-12', match: /⌀12/, price: 12, range: [8, 18], query: '镀铬光轴 直径12' },
  ],

  // 五金：按 hardware.name 正则匹配，单位元/件
  hardware: [
    { match: /压铸角件/, price: 0.8, query: '2020压铸角件' },
    { match: /T ?螺栓|螺栓\+螺母/, price: 0.5, query: 'T型螺栓 法兰螺母 M8' },
    { match: /悬挑托架/, price: 3.0, query: '型材层板托架' },
    { match: /可调支脚/, price: 2.5, query: '可调支脚 M10' },
    { match: /亚克力支撑卡扣/, price: 0.5, query: '亚克力板固定卡扣' },
    { match: /万向轮/, price: 6.0, query: '万向轮 2寸 带刹车' },
    { match: /调平地脚/, price: 3.0, query: '调平地脚 M12' },
    { match: /T ?型夹块/, price: 2.0, query: '光轴T型夹块' },
    { match: /斜撑端卡/, price: 1.0, query: '光轴固定卡夹' },
    { match: /横杆卡夹/, price: 1.5, query: '光轴横杆夹' },
    { match: /背板挂扣/, price: 1.0, query: '展板挂扣' },
    { match: /层板托夹/, price: 1.0, query: '层板托夹' },
  ],

  // 板件
  acrylicPerM2: { price: 150, range: [110, 200], query: '磨砂亚克力板 8mm' },
  zincPerM2: { price: 45, range: [30, 65], query: '镀锌钢板 薄板' },
  posterFlat: { price: 28, query: '海报打印 定制' }, // 元/张
};

/** 淘宝 / 1688 搜索直达链接 */
export function taobaoUrl(query) {
  return `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
}
export function alibabaUrl(query) {
  return `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(query)}`;
}
