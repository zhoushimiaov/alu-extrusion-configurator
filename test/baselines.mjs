// 基线回归基线单一来源：STATUS.md / AGENTS.md 中的数字只读参考，以此文件为准。
// 改默认配置导致基线变化时，更新此文件并在 commit message 说明原因。
// test/product-baselines.test.mjs 逐产品用默认配置重建并断言与此一致。
export default {
  // 型材架：6×6 大跨默认（2026-09-13 上线版）
  profile: { weightKg: 194.7, partCount: 1274, profileLengthM: 654.2 },
  // 光轴展架：忠实 GLB 逆向结构。2026-10-02 斜撑端点对齐 GLB（下端入端头夹块 y≈0.095、上端 y≈0.30，
  //   单根 0.276→0.291 m）：9.81→9.88 m、20.1→20.2 kg；脚轮 4 + 端头夹块 4 替代 轮 4 + 支架 4
  //   同日修复 T 型夹块实例数 12→14（右柱底盘横轴两只夹块此前越界丢失，GLB 两柱均有）：件数 45→47
  rod: { weightKg: 20.2, partCount: 47, profileLengthM: 9.88 },
  // 移动边几（2026-10-03 细节版：腿改为 2020 型材 + 两侧木纹板，全 2020 T 槽截面、底框双层叠梁、
  //   L 型光轴支座 ×8、板面光轴支座 ×8、竖向亚克力立板 ×2、玻璃广告钉 ×4；型材按 T 槽实体率 55% 计重）
  cart: { weightKg: 23.7, partCount: 60 },
  // 周转箱收纳架：4 层默认（2026-10-02 参考图复刻：三节钢珠滑轨 ×8、底框双层叠梁、角码板 ×16、不透明 EU 物流箱）
  crates: { weightKg: 34.8, partCount: 64 },
  // 光轴木展车（2026-10-02 按参考图重建为洞洞板展车：底台 + 展墙 + 全进深层板 + 顶台板 + 卡片挂杆 + 顶部挂架）
  woodcart: { weightKg: 47.9, partCount: 67 },
  // 光轴挂衣架：classic 光轴抽屉柜（默认）/ atelier 原木水磨石（ref/挂衣架.glb 复刻，落地底座）
  hanger: { weightKg: 72.4, partCount: 32 },
  //   2026-10-04 原木款底部改为 GLB 实测的「双抽屉柜（水磨石台面）+ 翻盖收纳箱」：原实心长凳 → 空腔抽屉柜，70.6/45 → 54.2/47
  hangerAtelier: { weightKg: 54.2, partCount: 47 },
};
