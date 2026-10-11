import {spawnSync} from 'node:child_process';
for(const [mode,name] of [['assessment','assessment'],['checkpoints','checkpoint-guide'],['drawings','schematics-and-placement'],['wiring','checkpoint-wiring'],['scale','scale-templates']]){
  const p=spawnSync('typst',['compile','revision6/guide.typ',`revision6/${name}.pdf`,'--input',`mode=${mode}`],{stdio:'inherit'});
  if(p.status!==0)process.exit(p.status??1);
  console.log(`revision6/${name}.pdf`);
}
