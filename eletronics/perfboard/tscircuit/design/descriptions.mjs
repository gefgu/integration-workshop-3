export function netDescription(net) {
 if(net==='GND')return 'Common electrical reference and return; keep student, USB and service ground identities consistent.';
 if(net==='5V_EDU')return 'Protected student supply, enabled only by the fault latch, watchdog and an explicit valid request.';
 if(/12V/.test(net))return 'Bench input or matrix supply; observe polarity and keep it away from educational contacts.';
 if(/3V3|USB_3V3/.test(net))return '3.3-V electronics supply. USB and bench supply domains must not be bridged.';
 if(/5V|PTC|SHUNT/.test(net))return 'Logic supply or current-protection path; verify the named supply domain and current direction.';
 if(/NODE|P[123]_RAW|BUS\d/.test(net))return 'Educational contact or routing bus; the wire joins only its listed terminals, not crossing wires.';
 if(/SDA|SCL/.test(net))return 'I2C service signal. Maintain separate per-position SDA paths and do not join buffer B sides.';
 if(/TEST|STIM|FIX/.test(net))return 'Manual continuity fixture connection; use only with student power OFF and disconnect stimulus before operation.';
 if(/SENSE|DIV|REF|ADC|BUFFER|BUF/.test(net))return 'Analog measurement, feedback or reference path; inspect polarity and compare with the specified calibration.';
 if(/GATE|OUT|RELAY|REQ|AMM/.test(net))return 'Output switching or current-limiting control; default OFF and mutually exclusive source/sink states are required.';
 if(/FAULT|RESET|PRESET|CLEAR|ALLOW|ALIVE|HEART|EN/.test(net))return 'Protection, reset or readiness control; its defined polarity must preserve OFF at startup and on faults.';
 return 'Named control/interconnect for '+net.replaceAll('_',' ').toLowerCase()+'. Verify both pin functions against the schematic before soldering.';
}
export function partDescription(b,p) {
 const section=b.sections.find(s=>s.name===p.section)?.label;
 const role=p.ref.replace(/^[A-Z]+_/,'').replaceAll('_',' ').toLowerCase();
 return `${p.ref}: ${role}; ${p.label}. Part of ${section}. ${p.adapter?`Install on ${p.adapter}; verify manufacturer pin numbering. `:''}Mount on the ${p.side} side; red pad identifies pin 1. ${p.kind==='capacitor'&&['470uF','10uF'].includes(p.value)?'Polarized: verify POS/NEG. ':''}${p.provisional?'Actual purchased dimensions must be measured before release.':''}`;
}
