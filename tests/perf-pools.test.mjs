/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Shared plaza pool grouping (perf afternoon 2026-11-18): pure-function contract of js/sj-pool-groups.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPools,POOL_GROUPING} from '../js/sj-pool-groups.js';

const item=(key,x,z,r,tri=100,cast=false)=>({key,x,y:0,z,r,tri,cast});

test('pools merge only within one key, and only when the merged sphere stays tight', () => {
  const items=[item('a',0,0,40),item('a',10,0,8),item('b',10,0,8),item('a',300,0,20),item('a',0,90,40)];
  const groups=groupPools(items);
  assert.deepEqual(groups,[[0,1],[2],[3],[4]]);
  // every index exactly once
  assert.deepEqual(groups.flat().sort((p,q)=>p-q),[0,1,2,3,4]);
});

test('merged radius never exceeds the larger member by more than delta, nor the cap', () => {
  const items=[];let seed=7;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<200;i++)items.push(item(i%3?'a':'b',rnd()*600,rnd()*600,2+rnd()*60,rnd()*3000,i%5===0));
  const groups=groupPools(items),{delta,cap}=POOL_GROUPING;
  assert.deepEqual(groups.flat().sort((p,q)=>p-q),items.map((_,i)=>i));
  for(const g of groups){
    if(g.length<2)continue;
    assert.ok(new Set(g.map(i=>items[i].key)).size===1);
    // Every merge step grows the larger side by ≤ delta and stays ≤ cap: all members fit in one sphere of radius cap,
    // so no two members span more than its diameter.
    for(const i of g)for(const j of g){const a=items[i],b=items[j];
      assert.ok(Math.hypot(a.x-b.x,a.z-b.z)+a.r+b.r<=2*cap+1e-6,`members ${i},${j} too far apart`);}
  }
  // two lone spheres farther apart than the larger radius + delta never merge
  assert.equal(groupPools([item('e',0,0,10),item('e',10+2*delta+1,0,10)]).length,2);
  assert.deepEqual(groupPools(items),groups,'deterministic');
});

test('shadow-casting pools are never merged (shadow pass unchanged); non-casting pools may be', () => {
  assert.equal(groupPools([item('c',0,0,30,10,true),item('c',5,0,30,10,true)]).length,2);
  assert.equal(groupPools([item('d',0,0,30,5000,false),item('d',5,0,30,5000,false)]).length,1);
});

test('paving clusters keep every triangle exactly once, in order, split at empty 128 m cells', async () => {
  const {pavingClusters,PAVING_CLUSTER_CELL:C}=await import('../js/sj-pool-groups.js');
  const tri=(x,z)=>[x,0,z,x+1,0,z,x,0,z+1];
  const flat=[...tri(5,5),...tri(1000,5),...tri(C+5,C+5),...tri(1010,6)];
  const parts=pavingClusters(flat);
  assert.deepEqual(parts,[[...tri(5,5),...tri(C+5,C+5)],[...tri(1000,5),...tri(1010,6)]]);
  const one=[...tri(5,5),...tri(20,20)];assert.equal(pavingClusters(one)[0],one,'single cluster: same array');
});
