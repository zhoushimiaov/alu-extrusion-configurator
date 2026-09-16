import struct,json,hashlib,collections,pathlib
import numpy as np
P=pathlib.Path(r'T:\Fang Tianyuan\铝型材\alu-frame.glb'); OUT=pathlib.Path(__file__).parent/'glb-reference';OUT.mkdir(exist_ok=True)
b=P.read_bytes(); magic,version,total=struct.unpack_from('<III',b);off=12;chunks={}
while off<len(b):
 n,t=struct.unpack_from('<II',b,off);chunks[t]=b[off+8:off+8+n];off+=8+n
j=json.loads(chunks[0x4e4f534a]);bin=chunks[0x004e4942]
def accessor(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']]; dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1',5122:'<i2',5120:'i1'}[a['componentType']]; k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]; d=np.dtype(dt);return np.ndarray((a['count'],k),dtype=d,buffer=bin,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',k*d.itemsize),d.itemsize)).copy()
def local(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4,order='F')
 x,y,z,w=n.get('rotation',[0,0,0,1]);r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 m=np.eye(4);m[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
records=[];geos=[]
def walk(i,parent,path):
 n=j['nodes'][i];m=parent@local(n);path=path+'/'+n.get('name',str(i))
 if 'mesh' in n:
  for pi,p in enumerate(j['meshes'][n['mesh']]['primitives']):
   assert p.get('mode',4)==4
   v=accessor(p['attributes']['POSITION']).astype(float);v=v@m[:3,:3].T+m[:3,3];f=accessor(p['indices']).reshape(-1,3) if 'indices' in p else np.arange(len(v)).reshape(-1,3)
   lo=v.min(0);hi=v.max(0); rec={'node':i,'mesh':n['mesh'],'primitive':pi,'path':path,'material':p.get('material'),'vertices':len(v),'triangles':len(f),'min':lo.tolist(),'max':hi.tolist(),'size':(hi-lo).tolist(),'center':((hi+lo)/2).tolist(),'matrix':m.tolist()};records.append(rec);geos.append((v,f))
 for c in n.get('children',[]):walk(c,m,path)
for i in j['scenes'][j.get('scene',0)]['nodes']:walk(i,np.eye(4),'')
summary={'file':str(P),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'asset':j.get('asset'),'extensionsUsed':j.get('extensionsUsed',[]),'meshCount':len(j['meshes']),'nodeCount':len(j['nodes']),'primitives':len(records),'triangles':sum(r['triangles'] for r in records),'worldMin':np.min([r['min'] for r in records],axis=0).tolist(),'worldMax':np.max([r['max'] for r in records],axis=0).tolist(),'materials':j.get('materials',[]),'sizeClusters':[(list(k),v) for k,v in collections.Counter(tuple(np.round(r['size'],5)) for r in records).most_common()]}
(OUT/'statistics.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8');(OUT/'nodes.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
if __name__=='__main__':
 print(json.dumps({k:v for k,v in summary.items() if k!='materials'},ensure_ascii=True,indent=2));print('MATERIALS',json.dumps(summary['materials'],ensure_ascii=True)); print('NAMES',[(r['node'],r['path'],r['size']) for r in records[:12]])
