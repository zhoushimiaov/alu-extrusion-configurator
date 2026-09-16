# 型材节点真实化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据已批准照片特征改善端面、搭接、内侧角码和支承，不改变采购数量、价格或承重结论。

**Architecture:** 保留 Three.js 实例装配与现有算料；以真实顶点 bounds 校验居中与接触。截面采用不自交 T 槽轮廓、中心孔与封闭减重腔；ExtrudeGeometry cap/side 两材质区分切面和拉丝。角码与孔为示意，不声称复刻未知内部连接。

**Tech Stack:** JavaScript / Three.js / Node test runner / Vite singlefile。

## 执行顺序
- [ ] 写计划后备份 src、test、package 文件及现有 dist/index.html；无 git 不初始化。
- [ ] 新建 test/geometry.test.mjs：真实 vertex bounds 验证 X 对称、2040 强轴、前后梁端点到柱侧的 JOINT_GAP；端面射线验证槽口、孔、空腔和实体；测试先红再修。
- [ ] 修改 src/core/profiles.js，生成有序边界及不同系列的槽/孔。保留 extrudeAlongX 的已正确旋转；修正文档注释。
- [ ] 修改 src/core/buildshelf.js，X 梁用 beamCutLength 缩放，Z 梁每端退 JOINT_GAP；板条底接梁顶；亚克力四角支承垫块置于梁顶并支承面板。
- [ ] 新建 src/core/joints.js：紧凑 L 角码、带真实六角凹孔的螺钉与环形垫片。每个实际梁端放内侧/梁底节点，视觉节点数与原采购数据分离，原 stats.hardware 不改。
- [ ] 修改 materials.js 加切割铝材质；anims.js 兼容材质数组并恢复原透明度；hud.js/main.js 增加按实际层高定位的节点近看。隐藏连接示意提示可见。
- [ ] npm test 与 npm run build；若可行使用浏览器打开本地页面检查整体、节点、亚克力并截图；不得关闭浏览器或发布。默认浏览器打开 dist/index.html 留父 agent 完成。

## 校验约束
对 2020/2040、不同跨宽、rib/acrylic/none 校验。采购清单、统计保持本轮前基线（既有模型不足只记录）；不修改 config/market.js 等后台价格。照片不是制造图：槽腔尺寸、螺钉规格、隐藏固定及 2mm 缝仍属示意。备份与最终测试数、截图、剩余问题在交付记录中列出。
