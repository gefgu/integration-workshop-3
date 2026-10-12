import {spawnSync} from 'node:child_process';
// --root . lets the guide read ../revision6/assessment.json for the before/after comparison.
for(const [mode,name] of [['assessment','assessment'],['checkpoints','checkpoint-guide'],['drawings','schematics-and-placement'],['wiring','checkpoint-wiring'],['scale','scale-templates'],['bringup','bringup-pass-tables'],['testpoints','probe-and-test-points']]){
  const p=spawnSync('typst',['compile','--root','.','revision7/guide.typ',`revision7/${name}.pdf`,'--input',`mode=${mode}`],{stdio:'inherit'});
  if(p.status!==0)process.exit(p.status??1);
  console.log(`revision7/${name}.pdf`);
}
