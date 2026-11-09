import {parts as baseline,gpio,serviceAllocation} from '../pcb-hct14-1face/model.mjs';
export {gpio,serviceAllocation};
export const parts=structuredClone(baseline);
for(const [name,x,x2]of [['H1',-10,-37],['H3',37,10]]){
 const h=parts.find(p=>p.ref===name),copy=structuredClone(h);
 copy.ref=name+'B';copy.x=x2;copy.y=-23.73;copy.pins=copy.pins.slice(6).map((p,i)=>({...p,pin:i+1}));copy.footprint='pinrow5_p2.54mm';
 h.pins=h.pins.slice(0,6);h.x=x;h.y=-25;h.footprint='pinrow6_p2.54mm';parts.push(copy);
}
export const sections=[...new Set(parts.map(p=>p.section))];
export const nets=[...new Set(parts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
export const routeNets=nets;
// Horizontal matrices stacked vertically expose repeated address pins to corridors.
const set=(ref,x,y,rotation)=>{const p=parts.find(p=>p.ref===ref);p.x=x;p.y=y;if(rotation!==undefined)p.rotation=rotation;};
set('J_ESP_L',-12.7,80);set('J_ESP_R',12.7,80);
set('U1',0,7,90);set('U2',0,-25,90);
set('H1',0,20,0);set('H1B',-1.27,-6,0);set('H3',0,-12,0);set('H3B',-1.27,-38,0);
set('U5',-23,35);set('U6',23,35);set('U_LEVEL',0,47);set('C_LEVEL',12,47);
set('C4',-35,35);set('C5',35,22);set('C1',-35,7);set('C2',35,-25);
set('R8',-9,30);set('R9',9,30);set('C_BULK5',-27,66);set('C_BULK12',27,66);
for(const [ref,x,y]of [['R_PD_23',-28,55],['R_PD_18',-14,53],['R_PD_22',-14,57],['R_PD_19',14,53],['R_PD_21',28,55]])set(ref,x,y);
// Keep the reset interface away from the register fanouts.
set('Q6',35,82);set('R6',35,77);set('R12',35,72);set('R7',35,67);
set('R7',38,67);
