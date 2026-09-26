// 首访 spotlight 引导（driver.js，~6KB gzip）：5 步走完核心闭环，
// localStorage 记号只跑一次；prefers-reduced-motion 用户直接跳过。
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const DONE_KEY = 'modulo.tour.v1';

export function maybeStartTour() {
  try {
    if (localStorage.getItem(DONE_KEY)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      localStorage.setItem(DONE_KEY, '1');
      return;
    }
  } catch { return; }

  const steps = [
    {
      element: '#viewport',
      popover: { title: '拖拽探索', description: '按住左键拖拽旋转视角，滚轮缩放，右键平移——模型实时渲染。' },
    },
    {
      element: '.product-tabs',
      popover: { title: '七条产品线', description: '顶部胶囊切换：型材架、光轴展架/书架、边几、周转箱、木展车、挂衣架。' },
    },
    {
      element: '.spec-grid',
      popover: { title: '实时算料', description: '在右侧面板调参数——规格、自重与报价随配置实时刷新。' },
    },
    {
      element: '[data-cta]',
      popover: { title: '收藏配置', description: '把当前配置加入清单，随时一键恢复或对比多个方案。' },
    },
    {
      element: '[data-export]',
      popover: { title: '一键导出', description: '算料单（Excel/WPS 可开）与 3D 模型 (.glb) 直接带走。' },
    },
  ];

  const drv = driver({
    animate: true,
    allowClose: true,
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '开始搭配',
    steps,
    onDestroyed: () => {
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* 隐私模式忽略 */ }
    },
  });
  drv.drive();
}
