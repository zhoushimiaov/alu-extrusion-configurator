// 参数化 20×10 支承条截面工厂：修复 20×10 横条截面自交与非流形网格缺陷。
// 槽口与中心孔均为程序化参数示意截面，用于消灭自交与非流形网格，不代表特定厂家的认证实测开模图纸。
// 原 profiles.js 为原封文件保留历史 baseline，当前产品由此工厂提供正确截面。
import * as THREE from 'three';

/**
 * 参数化 20×10 支承条截面（宽 20mm × 高 10mm）：
 * - 顶底双面各有 1 个参数化示意 T 槽（开口 5.2mm、唇厚 1.0mm、腔宽 8.2mm、槽深 2.8mm）；
 * - 左右 10mm 侧壁为平直实心外壁，无穿出或倒交错；
 * - 槽底保留 4.4mm 实心中心腹板，两侧置 ⌀2.4mm 工艺孔；
 * - 截面外环无自交，挤出后为封闭 2-流形（badEdges=0，degenerate=0）。
 */
export function makeExact2010Shape() {
  const hw = 0.010; // 半宽 10mm
  const hh = 0.005; // 半高 5mm
  const s = new THREE.Shape();

  // 20 系槽口示意几何参数（米）
  const A = 0.0026; // 槽口半开 5.2mm / 2
  const T = 0.0010; // 唇厚 1.0mm
  const B = 0.0041; // T 腔半宽 8.2mm / 2
  const D = 0.0028; // 槽深 2.8mm

  // 外轮廓：右下角起步；挤出器统一处理外环/孔环朝向。
  s.moveTo(hw, -hh);

  // 底面（向 -X 行进），中心槽口向 +Y 下凹
  s.lineTo(A, -hh);
  s.lineTo(A, -hh + T);
  s.lineTo(B, -hh + T);
  s.lineTo(B, -hh + D);
  s.lineTo(-B, -hh + D);
  s.lineTo(-B, -hh + T);
  s.lineTo(-A, -hh + T);
  s.lineTo(-A, -hh);
  s.lineTo(-hw, -hh);

  // 左侧壁（向 +Y）
  s.lineTo(-hw, hh);

  // 顶面（向 +X 行进），中心槽口向 -Y 下凹
  s.lineTo(-A, hh);
  s.lineTo(-A, hh - T);
  s.lineTo(-B, hh - T);
  s.lineTo(-B, hh - D);
  s.lineTo(B, hh - D);
  s.lineTo(B, hh - T);
  s.lineTo(A, hh - T);
  s.lineTo(A, hh);
  s.lineTo(hw, hh);

  // 右侧壁（向 -Y）
  s.lineTo(hw, -hh);
  s.closePath();

  // 左右各一个 ⌀2.4mm 中心腹板工艺孔（正八边形，避免圆弧离散退化共线三角面）
  const r = 0.0012;
  for (const bx of [-0.0055, 0.0055]) {
    const hole = new THREE.Path();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const x = bx + r * Math.cos(ang);
      const y = r * Math.sin(ang);
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    s.holes.push(hole);
  }

  return s;
}

/** 计算 20×10 截面的实际净截面积（外轮廓面积扣除两处工艺孔） */
export function computeExact2010Area() {
  const shape = makeExact2010Shape();
  const pts = shape.extractPoints(10);
  const polygonArea = points => {
    let a = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      a += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(a) / 2;
  };
  const outer = polygonArea(pts.shape);
  const holes = pts.holes.reduce((sum, h) => sum + polygonArea(h), 0);
  return outer - holes;
}

/** 20×10 真实净截面积（平方米，约 1.51934e-4 m²） */
export const EXACT_2010_AREA = computeExact2010Area();
