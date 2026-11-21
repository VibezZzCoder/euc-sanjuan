/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Tree and palm crowns as coarse ellipsoids for the riding camera (camera only: not colliders, not drawn). The area
// records that place trees are released after the world is built, so tools/bake-camera-crowns.mjs bakes this list into
// js/sj-camera-crowns-bake.js; tests/camera-crowns.test.mjs checks the bake against the live world.
// Each crown: centre x, y, z, horizontal radius, vertical radius (the dense part of the canopy, slightly inside the
// outermost lobes, so a sightline grazing a lobe edge is not counted).
const kit=(x,y,z,s)=>[x,y+5.2*s,z,3.2*s,1.6*s];            // js/sj-street-kit.js trees (trunk 3.4 s, lobes above)
const streetForm=(x,y,z,s)=>[x,y-.12+5.25*s,z,3.4*s,1.6*s]; // js/sj-streets.js broad shade tree form
const plazaTree=(x,y,z)=>[x,y+5.3,z,3,1.7];                  // js/sj-plaza.js six lobes at 4.7–5.5 m + top at 5.9 m
const pottedPalm=(x,y,z,s)=>[x,y+.8+1.85*s,z,1.6*s,.6*s];   // js/sj-plaza.js potted palms
const tallPalm=(x,y,z,h)=>[x,y+h,z,2.6,1.1];                // js/sj-palm.js crown at the trunk top

export function collectCrowns(world,areaKeys){
  const out=[],seen=new Set(),h=(x,z)=>world.height(x,z);
  const add=c=>{if(!c.every(Number.isFinite))return;const key=Math.round(c[0]*2)+','+Math.round(c[2]*2);if(seen.has(key))return;seen.add(key);
    out.push(...c.map(v=>Math.round(v*100)/100));};
  for(const t of world.plaza?.trees??[])add(plazaTree(t.x,t.y,t.z));
  for(const p of world.plaza?.palms??[])add(pottedPalm(p.x,p.y,p.z,p.scale??1));
  for(const p of world.gate?.palms??[])add(tallPalm(p.x,p.y,p.z,p.height??8.7));
  for(const k of areaKeys){const a=world[k];if(!a)continue;
    for(const t of a.broadleaf??[])add(k==='streets'?streetForm(t.x,t.y,t.z,t.scale??1):kit(t.x,t.y??h(t.x,t.z),t.z,t.scale??(t.size?t.size/1.4:1)));
    for(const t of a.trees??[])if(!Array.isArray(t))add(kit(t.x,t.y??h(t.x,t.z),t.z,t.scale??1));
    for(const p of a.palms??[])add(tallPalm(p.x,p.y??h(p.x,p.z),p.z,p.height??8.7*(p.scale??1)));}
  return out;
}
