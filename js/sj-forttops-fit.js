/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Baked fitRun output for the forttops inner fronts — © 2026 VibezZzCoder, MIT.
// fitRun (sj-fort-layout.js) on 13 authored polylines cost ~280 ms of world preparation. Its output is deterministic in
// (polyline, DEM, opts): `tools/bake-forttops.mjs` stores the stations/segments as Float32 in sj-forttops-bake.js with a
// key per front (polyline + inner + a checksum of the DEM around it). A key mismatch falls back to the runtime fit.
export const NUM=['x','z','t','s','seg','nx','nz','top','ground','base','need','lifted','dFoot','dIn','crest','dTop','bottom','walk','kerb','corner','flags'];
export const PTS=['F','B','L','LB','T','C','Q','W'];
export const STRIDE=NUM.length+PTS.length*2;
export function fitKey(pts,inner,terrain){
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),{x0,z0,step,nx,heights}=terrain;
  const i0=Math.floor((Math.min(...xs)-15-x0)/step),i1=Math.ceil((Math.max(...xs)+15-x0)/step),j0=Math.floor((Math.min(...zs)-15-z0)/step),j1=Math.ceil((Math.max(...zs)+15-z0)/step);
  let sum=0,sq=0;for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const h=heights[j*nx+i]??0;sum+=h;sq+=h*h*((i*7+j*13)%11+1);}
  return JSON.stringify([pts.map(p=>p.map(v=>+v.toFixed(3))),inner,+sum.toFixed(2),+sq.toFixed(1)]);
}
export function packFit(fit){
  const st=fit.segs.flatMap(g=>g.stations),a=new Float32Array(st.length*STRIDE);
  st.forEach((s,i)=>{const o=i*STRIDE;NUM.forEach((k,j)=>{a[o+j]=k==='flags'?(s.full?1:0)+(s.inserted?2:0):k==='corner'?(s.corner??-1):s[k];});
    PTS.forEach((k,j)=>{a[o+NUM.length+2*j]=s[k][0];a[o+NUM.length+2*j+1]=s[k][1];});});
  const segs=fit.segs.map(g=>({a:g.a,b:g.b,L:g.L,ux:g.ux,uz:g.uz,nx:g.nx,nz:g.nz,s0:g.s0,n:g.stations.length}));
  let bin='';const u=new Uint8Array(a.buffer);for(let i=0;i<u.length;i+=8192)bin+=String.fromCharCode(...u.subarray(i,i+8192));
  return {segs,data:btoa(bin)};
}
export function unpackFit(rec){
  const bin=atob(rec.data),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const a=new Float32Array(u.buffer);let i=0;
  const segs=rec.segs.map(g=>{const seg={...g,a:[...g.a],b:[...g.b],stations:[]};delete seg.n;
    for(let k=0;k<g.n;k++,i++){const o=i*STRIDE,s={};NUM.forEach((key,j)=>{s[key]=a[o+j];});
      const f=s.flags;delete s.flags;s.full=!!(f&1);if(f&2)s.inserted=true;if(s.corner<0)delete s.corner;
      PTS.forEach((key,j)=>{s[key]=[a[o+NUM.length+2*j],a[o+NUM.length+2*j+1]];});seg.stations.push(s);}
    return seg;});
  return {segs,stations:segs.flatMap(g=>g.stations)};
}
