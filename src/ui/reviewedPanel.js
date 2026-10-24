// Keep the protected panel's controls and subscriptions, while its summary
// dimensions share the finished assembly envelope used by the SVG annotations.
export function withAssemblyDimensions(panel, root) {
  return {
    ...panel,
    updateStats(stats) {
      panel.updateStats(stats);
      for (const [field, axis] of [['w','W'],['h','H'],['d','D']]) {
        const value=stats.envelope?.[axis];
        const cell=root.querySelector(`[data-spec="${field}"]`);
        if(cell && Number.isFinite(value)) cell.innerHTML=value.toFixed(2)+'<small>m</small>';
      }
    },
  };
}
