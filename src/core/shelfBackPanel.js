// 型材架背板挂装：GLB 背板现由 buildGlbFrame 直接「嵌入后柱体厚度范围」生成
// （板厚 -0.199..-0.187 完全落在后柱体 -0.20..-0.17 内，交接面埋在柱体内，
// 外部任何角度无接缝无漏光；层板条尾端 -0.20 仅露 1mm）。
// 本函数保留签名仅为兼容 main.js 既有调用；旧「外撤防穿模」后处理已随嵌入式挂装退役。
export function retreatShelfBackPanels(product) {
  void product;
}
