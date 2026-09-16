# HANDOVER LATEST — MODULO 铝型材置物架配置器

> 注：文中提到的 `DEPLOYMENTS.md` / `TOOLS.md` 是本地运维文档，**未随本仓库发布**；
> 公开侧的部署说明见 [`../docs/deployment.md`](../docs/deployment.md)。

> 项目：`F:\Autoclaw\alu_extrusion`  
> 更新：2026-09-07  
> 当前状态：本地源码、生产构建和 GLB 独立测试页均已更新；尚未发布线上。

## 1. 技术架构

纯前端 Vite + Three.js 单页应用，没有业务后端。

- 标准铝型材架：`src/core/buildShelf.js`
- 光轴架：`src/core/buildRodRack.js`
- GLB 实测参考装配：`src/core/buildGlbFrame.js`
- 截面工厂：`src/core/profiles.js`
- 原始参考模型：`model/alu-frame.glb`
- GLB 重建测试页：`model/glb-node-test.html`
- 生产构建：`dist/index.html`

## 2. 最新 GLB 节点状态

已确认以下两份 GLB 完全一致（SHA-256 相同）：

- `T:\Fang Tianyuan\铝型材\alu-frame.glb`
- `F:\Autoclaw\alu_extrusion\model\alu-frame.glb`

SHA-256：

`daecf36badf371b976caaad6e7f7f66e95e7a365015cde6017838223870d3633`

### 2.1 板条截面

不再凭截图猜测，也不再使用通用四面对称 T 槽。

从 GLB `mesh 7` 的端盖三角形直接提取：

- 外轮廓：44 点
- 内部孔：1 个四边形孔
- 外包尺寸：20.004 × 20.000mm
- 端盖三角形：48 个
- 有效截面积：约 127.20mm²

实现：`makeGlbStripShape()`  
数据：`model/strip-profile.json`  
提取器：`model/extract_profile.py`

### 2.2 中央节点／30×30 进深梁截面

用户最新圈选的位置不是板条，而是 30×30 进深梁端面。已从 GLB `mesh 10` 直接提取：

- 外轮廓：60 点，包含四向槽口
- 中心圆孔：64 点近似，直径约 6.8mm
- 四角空腔：4 个，约 2.7 × 2.7mm
- 外包尺寸：约 30 × 30mm
- 有效面积：约 303.56mm²

实现：`makeGlbJointShape()`  
数据：`model/joint-profile.json`  
生成器：`model/generate_joint_shape.py`

### 2.3 节点空间关系

GLB 测量所支持的参考关系：

- 一侧约 30×30mm 通高柱
- 另一侧约 30×30mm、长度 430mm 的分段柱
- 层间距约 460mm
- 进深梁约 30×30×370mm
- 板条约 20×20×400mm
- 板条在中央立柱两侧分别终止，不再穿柱
- 中央黑色连接块与横向螺栓是视觉说明件，不进入 BOM

此参考装配与原标准 2020/2040 拓扑不同，因此仍是独立测试模式，没有静默替换生产采购逻辑。

## 3. 最新验证基线

执行结果：

```text
npm test
32/32 pass

npm run build
通过

dist/index.html
603.16 kB（gzip 163.02 kB）
```

新增的精确截面测试：

- `test/exact-glb-profile.test.mjs`
- `test/exact-glb-joint-profile.test.mjs`

覆盖：

- 板条 44 点外环 + 1 个方孔
- 板条外包尺寸及有效面积
- 中央节点 60 点外环 + 1 个圆孔 + 4 个角孔
- 中央节点外包尺寸、孔径、角孔尺寸与位置

## 4. 当前可打开文件

### GLB 重建节点测试

`F:\Autoclaw\alu_extrusion\model\glb-node-test.html`

支持“节点近看”，用于检查板条端面与中央节点截面。

### 原始 GLB 查看器

`F:\Autoclaw\alu_extrusion\model\reference-viewer.html`

用于和原 GLB 全景、梁底节点对照。

### 生产构建

`F:\Autoclaw\alu_extrusion\dist\index.html`

## 5. 算料与价格状态

- cutList 已输出名义尺寸和演示下料长度。
- `JOINT_GAP=2mm/端` 仍是未验证假设，不能用于生产加工。
- 淘宝／1688 目前只是搜索入口。
- `market.js` 中单价是未核验示例，不是卖家实时价格。
- GLB 网格实例数量未去重，不能直接作为 BOM。
- GLB 精确截面仅用于参考装配，不改变标准 2020/2040 报价基线。

## 6. 已撤销的错误方案

曾按截图猜测“顶部单 T 槽 + V 形筋 + 底部双槽”的板条截面，用户判断更不准确。该方案及测试已删除，不应恢复。

现在的 GLB 截面来自网格端盖，不是该猜测方案。

## 7. 后续建议

1. 继续用原 GLB 截面提取方法定位其他关键构件，不再凭截图猜轮廓。
2. 如果要让 GLB 参考装配进入正式产品模式，必须先完成：
   - 节点 BOM 去重
   - 连接工法确认
   - 下料修正验证
   - 3030／2010 供应商 SKU 与价格核验
3. 给本项目建立 Git 仓库和版本标签；当前项目不是 Git 仓库。
4. 国内稳定访问入口、真实卖家采价后台仍未完成。

## 8. 常用命令

```bat
cd /d F:\Autoclaw\alu_extrusion
npm test
npm run build
```

当前真实回归基线为 **32/32 tests pass**。
