from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/ui/panel.js';s=p.read_text(encoding='utf-8')
a='  root.appendChild(seriesField);'
b='''    root.appendChild(seriesField);

  const frameField = el('div', null, `<div class="field-label"><span>装配模型 ASSEMBLY</span></div>`);
  const frameSeg = el('div', 'seg');
  for (const key of Object.keys(FRAME_MODES)) {
    const b = el('button', null, FRAME_MODES[key].label);
    b.dataset.seg = 'frameMode'; b.dataset.val = key;
    frameSeg.appendChild(b);
  }
  frameField.appendChild(frameSeg);
  root.appendChild(frameField);'''
assert a in s;s=s.replace(a,b,1)
a="    if (btn.dataset.seg === 'series') store.set({ series: btn.dataset.val });"
b=a+"\n    if (btn.dataset.seg === 'frameMode') store.set({ frameMode: btn.dataset.val });"
assert a in s;s=s.replace(a,b,1)
a="    seriesSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.series));"
b=a+"\n    frameSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.frameMode));"
assert a in s;s=s.replace(a,b,1)
p.write_text(s,encoding='utf-8');print('panel installed')
