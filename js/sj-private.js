/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Private-ground point tests built outside the layout scopes (perf ) — © 2026 VibezZzCoder, MIT.
// An area's `offLimitsAt` is held for the whole session by the terrain sampler. Written inline in a layout, the closure
// shares the layout function's context and keeps every construction index of that function alive (6.8 MiB for uptown's
// solid grid, 6.7 MiB for forttops). Closures created here capture only their arguments. Each factory returns exactly
// the expression its layout used before.
import {inRing,segmentDistance} from './sj-plaza-layout.js';

// [{r:ring, b:[minX,maxX,minZ,maxZ]}]: inside any ring (bounding box first).
export const ringsAt=list=>(x,z)=>list.some(o=>x>=o.b[0]&&x<=o.b[1]&&z>=o.b[2]&&z<=o.b[3]&&inRing(x,z,o.r));
// One ring with its bounds.
export const ringAt=(ring,b)=>(x,z)=>x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]&&inRing(x,z,ring);
// Grid-indexed rings: query(bb) returns candidate {r,bb} records (forttops' private pieces).
export const indexedRingsAt=query=>(x,z)=>query([x,x,z,z]).some(o=>x>=o.bb[0]&&x<=o.bb[1]&&z>=o.bb[2]&&z<=o.bb[3]&&inRing(x,z,o.r));
// Any of several tests.
export const anyOf=(...tests)=>(x,z,y)=>tests.some(t=>t(x,z,y));
// La Perla west: the cemetery ring or its field-side aprons, inside the grown cemetery box, but not on the wall foot.
export const cemeteryAt=(cbx,cemetery,apron,foot)=>(x,z)=>x>=cbx[0]-4&&x<=cbx[1]+4&&z>=cbx[2]-4&&z<=cbx[3]+4
  &&(inRing(x,z,cemetery)||apron.some(({q,b})=>x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]&&inRing(x,z,q)))
  &&!foot.some(({q,b})=>x>=b[0]-.3&&x<=b[1]+.3&&z>=b[2]-.3&&z<=b[3]+.3&&(inRing(x,z,q)||q.some((p,i)=>segmentDistance(x,z,p,q[(i+1)%q.length])<.3)));
// East civic: the sealed stair/overlook rectangles in their box, or the overlook's sea ledge.
export const eastcivicAt=(privateRects,overlookSea)=>(x,z)=>x>1100&&x<1180&&z>-175&&z<-85&&privateRects.some(r=>inRing(x,z,r))
  ||x>1089&&x<1198&&z<-227&&z>-266&&inRing(x,z,overlookSea);
// World edge: east of the closure line.
export const eastOf=limit=>x=>x>limit;
// One ring without a bounds check (waterfront's ferry terminal footprint).
export const inRingAt=ring=>(x,z)=>inRing(x,z,ring);
