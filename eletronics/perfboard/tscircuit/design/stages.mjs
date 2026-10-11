// Permanent component placements stay fixed; prototype sources use removable leads.
export function phaseFor(board,p) {
 if(board==='usb-prototype')return 0;
 if(board==='power')return p.section==='Input'||p.section==='Outputs'?9:p.section==='VoltageGuard'?10:11;
 if(board==='continuity-fixture')return 1;
 if(board==='a1')return p.section==='Nodes'||p.ref==='J_NODE'?0:4;
 if(board==='a2')return 27;if(board==='a3')return 28;
 if(board==='b1')return 29;if(board==='b2')return 30;if(board==='b3')return 31;
 if(board==='smart-controller')return 15;
 if(board==='smart-channel')return ({Interface:6,Voltage:6,Limits:15,Output:15,Current:22})[p.section];
 if(board==='matrix')return p.ref==='U_ESP1'||p.ref==='J_PROTOTYPE'||p.ref==='J_FIXTURE'?0:p.section==='Watchdog'?13:p.section==='Return'||p.ref==='J_POWER'?11:24;
 if(board==='integration')return p.ref==='J_NFC'?34:32;
 throw Error(`Missing phase ${board}/${p.ref}`);
}
export const phaseForInstance=(id,p)=>id.startsWith('smart-channel:')&&id!=='smart-channel:0'?26+Number(id.split(':')[1]):p.phase;
