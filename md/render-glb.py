import runpy,collections
s=runpy.run_path(__file__.replace('render-glb','analyze-glb'));globals().update({k:s[k] for k in ['np','records','geos','OUT','summary']})
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
origin=np.array(summary['worldMin']);origin[1]=0
vs=[(v-origin)*1000 for v,f in geos]
for dims in [(20,20,400),(600,10,20),(30,30,370),(30,430,30),(30,2330,30)]:
 ids=[i for i,r in enumerate(records) if np.allclose(np.array(r['size'])*1000,dims,atol=.02)]
 print('GROUP',dims,'count',len(ids),'first',[(records[i]['node'],np.round(vs[i].min(0),2).tolist(),np.round(vs[i].max(0),2).tolist()) for i in ids[:8]])
 print('centers XYZ', [np.unique(np.round([vs[i].mean(0)[k] for i in ids],1)).tolist() for k in range(3)])
def render(name,center=None,radius=None,ids=None,axes=(0,1),iso=False):
 fig,ax=plt.subplots(figsize=(15,9));ts=[];cs=[]
 for i,(v0,f) in enumerate(geos):
  if ids is not None and i not in ids:continue
  v=vs[i];tri=v[f]
  if center is not None:
   mask=np.all(tri.max(1)>=center-radius,axis=1)&np.all(tri.min(1)<=center+radius,axis=1);tri=tri[mask]
  if not len(tri):continue
  normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-20)
  brightness=.45+.5*np.abs(normals@np.array([.3,.8,.52]));base=np.array([.65,.72,.78]) if records[i]['material']!=0 else np.array([.8,.25,.3])
  if records[i]['node'] in [0,2,3]:base=np.array([1,.4,.1])
  cs.append(np.c_[brightness[:,None]*base,np.ones(len(tri))]);ts.append(tri)
 tri=np.concatenate(ts);c=np.concatenate(cs)
 if iso:
  right=np.array([.83,0,-.55]);up=np.array([.22,.916,.33]);depth=np.cross(right,up);p=np.stack([tri@right,tri@up],axis=2);order=np.argsort(tri.mean(1)@depth)
 else:
  p=tri[:,:,axes];other=({0,1,2}-set(axes)).pop();order=np.argsort(tri.mean(1)[:,other])
 ax.add_collection(PolyCollection(p[order],facecolors=c[order],edgecolors='none',linewidth=0,rasterized=True));ax.autoscale();ax.set_aspect('equal');ax.set_facecolor('#f2f4f7');ax.set_title(name+' | actual GLB triangles | mm from world-min X/Z');ax.set_xlabel('projected mm' if iso else 'XYZ'[axes[0]]+' mm');ax.set_ylabel('projected mm' if iso else 'XYZ'[axes[1]]+' mm');ax.grid(alpha=.15)
 if center is not None:
  corners=np.array([center+radius*np.array([a,b,c]) for a in [-1,1] for b in [-1,1] for c in [-1,1]])
  cp=np.c_[corners@right,corners@up] if iso else corners[:,axes]
  if ids is None:ax.set_xlim(cp[:,0].min(),cp[:,0].max());ax.set_ylim(cp[:,1].min(),cp[:,1].max())
 fig.tight_layout();fig.savefig(OUT/(name+'.png'),dpi=160);plt.close(fig)
render('01-overview-isometric',iso=True)
render('02-front-XY',axes=(0,1))
render('03-side-ZY',axes=(2,1))
render('04-top-XZ',axes=(0,2))
render('05-left-bottom-joint',center=np.array([30,460,200]),radius=np.array([100,90,260]),iso=True)
render('06-fasteners-isolated',ids=[0,1,2],iso=True)
# Isolated representative profiles to inspect actual shape, without PCA ambiguity.
for dims,name in [((20,20,400),'07-deck-section'),((30,30,370),'08-depth-beam-section'),((600,10,20),'09-width-rail-section')]:
 i=next(i for i,r in enumerate(records) if np.allclose(np.array(r['size'])*1000,dims,atol=.02));v=vs[i]; axis=int(np.argmax(dims));center=v.min(0);center[axis]+=1;radius=np.array([1000.,1000.,1000.]);radius[axis]=1.1;render(name,center=center,radius=radius,ids=[i],axes=tuple(k for k in range(3) if k!=axis))
