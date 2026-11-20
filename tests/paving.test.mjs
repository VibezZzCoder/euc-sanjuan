/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createPlazaLayout,inRing} from '../js/sj-plaza-layout.js';
import {createPavingRegions,pavingInputs,intersectRings,signedArea} from '../js/sj-paving.js';
const city=JSON.parse(readFileSync(new URL('../data/city.json',import.meta.url)));
const detail=JSON.parse(readFileSync(new URL('../data/plaza-detail.json',import.meta.url)));
const plaza=createPlazaLayout({city,detail,height:()=>0,terrain:{x0:-200,z0:-200,step:400,nx:2,nz:2,heights:[0,0,0,0]}});
const inputs=pavingInputs(detail,plaza),regions=createPavingRegions(detail,plaza);

test('all real plaza/road pieces have a single material owner',()=>{
  assert.ok(regions.length>inputs.length&&regions.length<100);
  for(let i=0;i<regions.length;i++) {
    assert.ok(regions[i].ring.every(p=>p.every(Number.isFinite)));
    for(let j=i+1;j<regions.length;j++)
      assert.ok(Math.abs(signedArea(intersectRings(regions[i].ring,regions[j].ring)))<1e-7,`regions ${i}/${j}`);
  }
});
test('independent point coverage retains the union and intended priority without cracks',()=>{
  let covered=0;
  for(let z=-57.123;z<108;z+=.71)for(let x=-99.371;x<85;x+=.73) {
    const expected=inputs.find(r=>inRing(x,z,r.ring));
    const owners=regions.filter(r=>inRing(x,z,r.ring));
    assert.equal(owners.length,expected?1:0,`coverage at ${x},${z}`);
    if(expected){assert.equal(owners[0].kind,expected.kind);covered++;}
  }
  assert.ok(covered>5000);
});
test('shared/contained edges and mixed junctions partition deterministically',()=>{
  const d={plaza:{ring:[[0,0],[10,0],[10,10],[0,10]]}};
  const p={paving:[{a:[0,5],b:[10,5],width:2,kind:'sett'},
    {a:[5,0],b:[5,10],width:2,kind:'asphalt'},
    {a:[0,5],b:[10,5],width:2,kind:'sett'}]};
  const result=createPavingRegions(d,p);
  const total=kind=>result.filter(r=>r.kind===kind).reduce((n,r)=>n+Math.abs(signedArea(r.ring)),0);
  assert.ok(Math.abs(total('asphalt')-20)<1e-9);
  assert.ok(Math.abs(total('sett')-16)<1e-9);
  assert.ok(Math.abs(total('plaza')-64)<1e-9);
  assert.deepEqual(createPavingRegions(d,p),result);
});
test('a mapped bend shares its complete cross-section instead of leaving square-cap wedges',()=>{
  const d={plaza:{ring:[[50,50],[51,50],[51,51],[50,51]]}};
  const p={paving:[{a:[-8,0],b:[0,0],width:4,kind:'sett',source:99},
    {a:[0,0],b:[8,3],width:4,kind:'sett',source:99}]};
  const [a,b]=pavingInputs(d,p);
  assert.deepEqual(Float32Array.from(a.ring[1]),Float32Array.from(b.ring[0]));
  assert.deepEqual(Float32Array.from(a.ring[2]),Float32Array.from(b.ring[3]));
  assert.ok(Math.abs(signedArea(intersectRings(a.ring,b.ring)))<1e-8);
  assert.ok(a.ring[1][0]<0&&a.ring[2][0]>0,'Bend uses a shared sloping mitre, not two flat caps');
});
