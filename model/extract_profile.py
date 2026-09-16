import struct,json,sys,collections,math
from pathlib import Path
p=Path(sys.argv[1]); raw=p.read_bytes(); assert raw[:4]==b'glTF'; n,t=struct.unpack_from('<II',raw,12); J=json.loads(raw[20:20+n]); off=20+n; bn,bt=struct.unpack_from('<II',raw,off); BIN=raw[off+8:off+8+bn]
node_i=int(sys.argv[2]); node=J['nodes'][node_i]; mesh=J['meshes'][node['mesh']]
prim=mesh['primitives'][0]; ai=prim['attributes']['POSITION']; ii=prim['indices'];
def accessor(i):
 a=J['accessors'][i];v=J['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0); comp=a['componentType'];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[comp];nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];sz=struct.calcsize('<'+fmt*nc);stride=v.get('byteStride',sz);return [struct.unpack_from('<'+fmt*nc,BIN,start+k*stride) for k in range(a['count'])]
V=accessor(ai); I=[x[0] for x in accessor(ii)]; dims=[max(v[k] for v in V)-min(v[k] for v in V) for k in range(3)]; axis=max(range(3),key=lambda k:dims[k]); uv=[k for k in range(3) if k!=axis]; cut=min(v[axis] for v in V);tol=1e-6
edges=collections.Counter();pts={}
def key(v):return tuple(round(v[k],6) for k in uv)
tris=[]
for q in range(0,len(I),3):
 tri=[V[I[q+r]] for r in range(3)]
 if all(abs(v[axis]-cut)<=tol for v in tri):
  ks=[key(v) for v in tri];tris.append(ks)
  for a,b in [(ks[0],ks[1]),(ks[1],ks[2]),(ks[2],ks[0])]:edges[tuple(sorted((a,b)))]+=1
boundary=[e for e,c in edges.items() if c==1];adj=collections.defaultdict(list)
for a,b in boundary:adj[a].append(b);adj[b].append(a)
loops=[];unused=set(boundary)
while unused:
 e=unused.pop();loop=[e[0],e[1]];prev,cur=e
 while cur!=loop[0]:
  nxt=next((x for x in adj[cur] if x!=prev and tuple(sorted((cur,x))) in unused),None)
  if nxt is None:break
  unused.remove(tuple(sorted((cur,nxt))));loop.append(nxt);prev,cur=cur,nxt
 if loop[-1]==loop[0]:loops.append(loop[:-1])
def area(L):return sum(L[i][0]*L[(i+1)%len(L)][1]-L[(i+1)%len(L)][0]*L[i][1] for i in range(len(L)))/2
out={'node':node_i,'mesh':node['mesh'],'local_dims':dims,'axis':axis,'cut':cut,'end_triangles':len(tris),'degree_counts':collections.Counter(map(len,adj.values())),'loops':[{'area':area(L),'points':L} for L in sorted(loops,key=lambda x:-abs(area(x)))]}
Path(sys.argv[3]).write_text(json.dumps(out,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in out.items() if k!='loops'},default=dict));print('loops',[(round(x['area'],8),len(x['points'])) for x in out['loops']])
