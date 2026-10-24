// BOM 公共统计口径：UI、Excel、打印报告必须复用同一个纯函数。
// 线材以米合计；板件/成品件不可把单边尺寸当作“总下料长度”。
export function summarizeBom(stats = {}) {
  const cuts = Array.isArray(stats.cutList) ? stats.cutList : [];
  const linear = cuts.filter(c => c.section !== '板' && c.section !== '件');
  const panels = cuts.filter(c => c.section === '板');
  const assemblies = cuts.filter(c => c.section === '件');
  const cutLengthM = linear.reduce((sum, c) =>
    sum + (Number.isFinite(c.len) && Number.isFinite(c.qty) ? c.len * c.qty : 0), 0);
  const panelCount = panels.reduce((sum, c) => sum + (Number.isFinite(c.qty) ? c.qty : 0), 0);
  const assemblyCount = assemblies.reduce((sum, c) => sum + (Number.isFinite(c.qty) ? c.qty : 0), 0);
  return { cutLengthM, panelCount, assemblyCount };
}
