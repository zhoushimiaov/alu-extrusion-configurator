// 背板饰面注册：product.js 为原封文件，新增饰面在此向 PANEL_COLORS 追加属性
// （const 对象的属性可变；panel.js 的色板渲染遍历 Object.keys(PANEL_COLORS)，
//  追加后色板/选中态/持久化自动生效，无需改任何原封代码）。
import { PANEL_COLORS } from '../config/product.js';

if (!PANEL_COLORS.spangle) {
  PANEL_COLORS.spangle = {
    label: '幻彩镀锌',
    hex: 0xc6ccd3,
    roughness: 0.42,
    metalness: 0.5,
    spangle: true, // buildGlbFrame 据此挂程序化锌花纹理
  };
}
