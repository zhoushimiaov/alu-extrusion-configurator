// 基线回归基线单一来源：STATUS.md / AGENTS.md 中的数字只读参考，以此文件为准。
// 改默认配置导致基线变化时，更新此文件并在 commit message 说明原因。
export default {
  // 型材架：6×6 大跨默认（2026-09-13 上线版）
  profile: { weightKg: 194.7, partCount: 1274, profileLengthM: 654.2 },
  // 光轴展架：忠实 GLB 逆向结构（基线历次验证不变）
  rod: { weightKg: 20.1, partCount: 45, profileLengthM: 9.81 },
  // 移动边几（2026-09-19 腿部组合结构重构后：型材+木纹板组合腿、贴地踏杆、外露螺栓、叉式万向轮；
  //             同轮对抗审查修复 X 梁穿模 5mm，梁长 +18mm → 24.9kg）
  cart: { weightKg: 24.9, partCount: 62 },
  // 周转箱收纳架：4 层默认（2026-09-15 箱体尺寸约束修正后）
  crates: { weightKg: 33.5, partCount: 46 },
  // 光轴木展车
  woodcart: { weightKg: 38.8, partCount: 38 },
};
