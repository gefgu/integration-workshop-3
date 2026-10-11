import {checkpoints as legacy} from './legacy-checkpoints.mjs';
const old=(cp,...indexes)=>indexes.map(i=>legacy[cp].tests[i-1].description);
const definitions=[
 ['First LED','First light','ESP32 switches the real four-column LED loop.',[
 'Identify the exact classic ESP32 DevKit pinout, the USB-powered 5V output and 3V3 output. Identify actual pogo and adapter dimensions before soldering. Confirm the four kit pieces fit the selected rows.',
 'Unpowered A1: all six contacts within each column <1Ω; different columns >10MΩ with external links isolated. Inspect pin1 and the NODE header mapping.',
 'Prototype disconnected from A1: measure USB 5V ≤5.25V and 3V3 3.20–3.38V. R_LIMIT is 560Ω ±1%, ≥0.25W. With its output shorted, source current ≤9.5mA; remove short before connecting the kit.',
 'Place fake battery negative C1 / positive C2, 1kΩ resistor C2–C3, LED anode C3 / cathode C4, and kit jumper C4–C1. Prototype J_OUTPUT pin1→A1 J_NODE pin3 and pin2→pin1. No final-power or matrix cable connected.',
 'Compatible factory firmware: GPIO32 LOW/reset makes LED OFF; explicit enable lights LED; disable turns it OFF. Record USB-test-source voltage at C2 under load; it is intentionally unregulated and must not be called the final 5V rail.'
 ]],
 ['Continuity','Reject an open contact','A lifted jumper contact is electronically rejected.',old(1,1,2,3)],
 ['Continuity','Reject a wrong node','A convincing-looking jumper on the wrong node is rejected.',[legacy[1].tests[2].description,legacy[1].tests[3].description]],
 ['Continuity','Correction needs a fresh test','Correcting the jumper requires a fresh pass and a separate enable request.',[legacy[1].tests[4].description,legacy[1].tests[3].description]],
 ['Screen','Capsule greeting','One capsule displays a real pt-BR greeting.',[
 'Connect only one OLED at 0x3C to ESP1 FIX_SDA GPIO4 / FIX_SCL GPIO16 using 3.3V logic and removable leads. Use one effective set of pull-ups; continuity fixture must be unplugged when it is not used. Confirm carrier pin labels before power.',
 'OLED displays greeting with educational source OFF. Display unplug/reconnect and reset do not automatically enable the source.'
 ]],
 ['Screen','Identity and OFF status','The capsule displays its identity and actual OFF/ready state.',[
 'Display position A1, firmware revision, and Desligado/Pronto states. Never substitute a simulated GUI status for an actual hardware observation.'
 ]],
 ['Voltage','Voltage calibration','The voltage input matches known zero and reference readings.',old(3,1,2)],
 ['Voltage','Read real voltage','The capsule reading follows the multimeter as loop voltage changes.',[
 'With prototype source and diagnostic probes isolated as specified, compare capsule V(P1)−V(P2) with DMM at zero and the actual limited-source voltage. Error ≤0.10V+5%|reading|; ≥10 updates/s. All node absolute voltages 0–5.25V.'
 ]],
 ['Voltage','Signed voltage','Swapping only the measurement leads reverses the reading sign.',[
 'Power OFF before swapping P1/P2 removable measurement leads. Compare signed differential reading with DMM in both orientations; never apply a negative absolute node voltage. P3 and ammeter paths remain disconnected.'
 ]],
 ['Final power','Regulated rails','The isolated final regulators produce their specified voltages.',old(0,2,3)],
 ['Final power','Overvoltage guards','Each supply guard rejects an out-of-range source.',old(0,9)],
 ['Final power','OFF at startup and reset','The final student rail remains OFF at startup and reset.',[
 'Prototype USB positive and 3V3 supply links are removed before connecting final consumer links. Only one educational source may be connected. Inspect all power-board blocks before enabling; the student latch must not be powered as an incomplete circuit.',
 'Supervised factory qualification only: ALIVE is held LOW for startup/reset tests. All consumer links remain open until voltage guards pass. USB removal, held reset and a power cycle leave 5V_EDU OFF.'
 ]],
 ['Final power','Overload trip and latch','An overload shuts down and stays latched until a valid reset.',[...old(0,6,7),'Supervised factory load test only: with power OFF, USB3V3→matrix J_POWER pin9 holds ALIVE high until CP13 watchdog exists. Explicit enable applies the bounded load; reset under overload must not release the latch. Remove the factory ALIVE link or hold it LOW to simulate heartbeat loss and prove OFF. Remove this link permanently at CP13.']],
 ['Final power','Heartbeat shutdown','Stopping the controller heartbeat switches the final rail OFF.',[
 'Replace any supervised factory ALIVE link with the completed USB-powered hardware watchdog. Send heartbeat ≤100ms; stopping heartbeat or removing USB must switch rail OFF within 350ms and not restart automatically. Record scope timing.'
 ]],
 ['Final power','Cutoff timing and transients','Measured cutoff timing and contact peaks meet the final limits.',old(0,8,9)],
 ['Smart output','Bounded source and sink','Smart output drives valid levels and limits short-circuit current.',old(4,1,2)],
 ['Smart output','Pulse frequency','The real output changes its blink frequency.',old(4,3)],
 ['Smart output','Pulse duty cycle','Changing duty cycle changes the real pulse waveform.',[
 'Scope 25%, 50%, 75% duty at a known frequency; error ≤5 percentage points. Frequency 0.5–10Hz ±5%; ≥5ms break-before-make; changing mode first turns output OFF.'
 ]],
 ['Logic and memory','AND gate','The LED follows the AND truth table.',[legacy[5].tests[0].description,'Record all four AND input combinations using bounded removable links and DMM-confirmed input levels.']],
 ['Logic and memory','OR gate','The LED follows the OR truth table.',['Record all four OR input combinations: input ≤1V LOW, ≥3V HIGH; 20ms stability and output response ≤100ms.']],
 ['Logic and memory','NOT gate','The LED follows the NOT truth table.',['Record LOW→HIGH and HIGH→LOW inversion; retain previous state in the input hysteresis band. Reset and invalid configurations leave output OFF.']],
 ['Logic and memory','SR memory','Set persists, and reset wins.',old(6,1,2)],
 ['Current','Current calibration','The ammeter matches known signed currents.',old(7,1,2,3)],
 ['Current','Read loop current','Changing a real resistor changes measured series current.',[
 'Power OFF to change the documented series fixture between 1kΩ and 470Ω. Compare OLED current with DMM; ≤0.20mA+5%|reading| error. Never put the ammeter directly across the supply.'
 ]],
 ['Matrix','Route one LED loop','The matrix completes one bounded LED loop.',old(8,1,2,3,4,5)],
 ['Matrix','Inspect a routed jumper','The matrix test tools distinguish a routed short from an open.',old(8,6,7,8)],
 ['Matrix','Reject an invalid route','Invalid or stale routing requests keep power OFF.',old(8,9)],
 ['Expansion','Qualify A2','The same capsule works at A2 without changes.',old(9,1,2,3)],
 ['Expansion','Qualify A3','Three bank-A positions operate with no address collisions.',[
 'Repeat the single-position acceptance at A3; exercise all three bank-A capsules concurrently. Every buffer B-side remains local, and every position retains the same mode capabilities.'
 ]],
 ['Expansion','Qualify B1','A capsule moves to B1 without rotation or polarity changes.',old(10,1,2)],
 ['Expansion','Qualify B2','The same capsule passes acceptance at B2.',['Repeat single-position voltage, output, current, OLED and movement shutdown checks at B2 with unchanged capsule orientation.']],
 ['Expansion','Qualify B3','All six positions work while only three capsules are active.',[legacy[10].tests[2].description,'Repeat single-position checks at B3; attempt a fourth active capsule and confirm rejection with power OFF.']],
 ['Integration','Pi communication','Pi commands reach the controllers with revisioned acknowledgements.',old(11,1,2)],
 ['Integration','Session-gated enable','Only a valid session and fresh acknowledgements permit enable.',old(11,3)],
 ['Integration','Known NFC identity','A known NFC identity participates in approval.',[legacy[12].tests[0].description,'Known identity, valid lesson and fresh controller ACKs permit a separate explicit enable request. NFC alone never energizes.']],
 ['Integration','Reject NFC failures','Unknown, absent or failed NFC cannot authorize power.',[legacy[12].tests[1].description]],
 ['Integration','Complete lesson','An enclosed full lesson completes with its fault cases demonstrated.',old(13,1,2,3,4,5)]
];
export const chapters=[...new Set(definitions.map(d=>d[0]))].map((title,i)=>({id:`chapter-${i}`,title}));
const negativeExamples=["Disable or reset the ESP32: the LED must go dark without touching the kit.", "Lift the return jumper while retaining its convincing visual position: the electronic test rejects it.", "Connect the jumper to a different column: electronic rejection persists despite simulated camera approval.", "Refit the correct jumper without a new test: it must remain OFF until a fresh pass and separate enable request.", "Unplug the OLED with power OFF: report missing hardware; a simulated greeting is not a pass.", "Change identity or remove the capsule: retain OFF and require a new configuration.", "Apply a known reference outside the accepted calibration tolerance: reject the calibration.", "Remove the measured source: display the actual near-zero voltage, not a cached reading.", "Reverse the test leads: the sign must reverse with the same magnitude tolerance.", "Apply no input: outputs remain unpowered; never invent a regulator reading.", "Raise each rail above its documented trip threshold using the bounded fixture: guard must reject.", "Reset or reconnect USB with enable previously requested: startup remains OFF.", "Apply the qualified overload: shutdown latches; clearing the fault does not re-enable.", "Hold heartbeat static HIGH or LOW: watchdog must time out and disable power.", "Capture the documented cutoff transient; an excessive peak or slow shutdown is a failure.", "Use the qualified bounded short test: hardware clamps current and remains within limits.", "Request a frequency outside 0.5\u201310Hz: reject configuration with output OFF.", "Request duty outside 25\u201375%: reject configuration with output OFF.", "AND inputs01,10 and00 must remain LOW; only11 may be HIGH.", "OR inputs00 must remain LOW;01,10 and11 must be HIGH.", "NOT inputHIGH must produce LOW; inputLOW must produce HIGH.", "Assert set and reset together: reset wins; rail-off loses the stored state.", "Use an incorrect current calibration: reject it rather than displaying an accepted value.", "Exit current mode: both ammeter terminals disconnect; verify rather than shorting the supply.", "Remove enable or a required acknowledgement: matrix LED loop remains OFF.", "Select a known open diagnostic path: return rejection rather than a false continuity pass.", "Submit the documented invalid topology: reject it without energizing.", "Move or remove the capsule from A2: power shuts down before reconfiguration.", "Move or remove the capsule from A3: power shuts down before reconfiguration.", "Move the unchanged-orientation capsule to B1: old-position authorization must not energize it.", "Remove the capsule from B2: stale identity cannot keep output enabled.", "Request a fourth active capsule: reject it and retain OFF.", "Use a mismatched, expired or duplicate acknowledgement: communication cannot authorize enable.", "Expire the session or lose communication: output shuts down without autonomous restoration.", "Present a known NFC identity without a valid session: NFC alone cannot energize.", "Present unknown, absent or failed NFC: authorization is denied and power stays OFF.", "Run the complete lesson fault cases, including communication loss and invalid topology: each disables power."];
export const checkpoints=definitions.map(([chapter,title,win,tests],phase)=>{
 const early=phase<9,continuity=phase>=1&&phase<=3;
 const links=continuity?['USB test-source positive lead unplugged; final supply and matrix leads absent.','TEST_A→A1 C4, TEST_B→C1; JP_RETURN fitted only during diagnostic test.','Before LED enable: stimulus OFF, JP_RETURN/probes removed, prototype positive restored with power OFF.']:early?['Prototype source only: positive C2 / ground C1; final supply and matrix disconnected.','OLED uses ESP1 GPIO4 SDA / GPIO16 SCL at 3.3V. Remove diagnostic probes before ordinary operation.']:['USB prototype source and prototype 3V3 links removed before final supplies connect.','Use checkpoint-specific bounded test loads; stop and isolate power before changing any link.'];
 let firmware=phase===0?'factory LED: GPIO32 defaults LOW; explicit enable/disable; GPIO25 stimulus LOW; all future routing/output controls LOW':continuity?'factory fixed-pair continuity: GPIO4 SDA,16 SCL,25 stimulus; ADS1115 0x48; manual source isolation; reject open/wrong/inconclusive, fresh test + explicit enable':phase<6?'factory OLED on ESP1: GPIO4 SDA /16 SCL, 0x3C; report identity and OFF/ready; no relay requests':phase<9?'factory voltage: ESP1 OLED + local ADS1115 0x48; USB3V3 to isolated card supply via removable links; P3/ammeter disconnected':phase<15?'factory final-power qualification: explicit enable/reset; supervised ALIVE link only before CP13; no production authorization':phase<24?'smart factory mode on ESP2: migrate OLED/ADC service to its isolated position bus; register outputs OFF until qualified; valid heartbeat required':phase<32?'router+smart production interlock: final power qualified; valid topology; bounded matrix tool current; fresh ACKs': 'complete Pi/router/smart session and NFC interlock';
 if(phase>=15&&phase<=23)links.push('For smart-mode bench fixtures, disconnect both fixed battery leads and remove the initial kit loop. Output load: P3→1kΩ→LED anode, LED cathode→GND through removable leads. Logic inputs: HIGH=qualified3V3_SYS through1kΩ; LOW=GND through1kΩ. AND/OR exercise00,01,10,11; NOT exercise0,1. Never parallel another source with P3. Current tests use a documented series path, never an ammeter across the supply.');
 if(phase>=24)links.push('Remove all fixed source patch leads before matrix routing. Source node selection now belongs to the qualified matrix topology.');
 if(phase===6)links.push('Remove the manual continuity fixture (ADC0x48 collision) and direct OLED bus leads; use the temporary smart-card A-side interface through its TCA9517.');
 if(phase===11||phase===12)links.push('Factory ALIVE fixture is temporary: J_PROTOTYPE pin2 USB3V3→J_POWER pin9 only during supervised load qualification. LOW/open for startup/reset; remove permanently before CP13.');
 return{id:`CP${String(phase).padStart(2,'0')}`,phase,chapter:chapters.find(c=>c.title===chapter).id,title,win,prerequisites:phase?[`CP${String(phase-1).padStart(2,'0')}`]:[],boards:[],firmware,firmwareImplemented:false,links,equipment:phase<9?['USB cable','Multimeter']:['Multimeter','Current-limited adjustable supply','Oscilloscope for timing/transient tests'],tests:tests.map((description,i)=>({id:`guided-cp${phase}-test${i+1}`,description,source:'manual',required:true})),filming:{initialState:links.join(' '),shots:[`Show ${title.toLowerCase()} setup with power OFF and display firmware revision.`,`Demonstrate: ${win}`,'Show the documented negative test and actual recorded readings.'],negative:negativeExamples[phase],record:'Record readings and units, equipment, link positions, firmware revision and outcome. Firmware is a contract only; never film simulated readings as measured hardware evidence.'}};
});
