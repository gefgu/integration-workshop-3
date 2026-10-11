import {spawnSync} from 'node:child_process';
for(const [mode,file] of [['architecture','architecture'],['drawings','schematics-and-placement'],['wiring','checkpoint-wiring'],['early','cp00-cp08']]){
 const result=spawnSync('typst',['compile','revision5/guide.typ',`revision5/${file}.pdf`,'--input',`mode=${mode}`],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);console.log(`revision5/${file}.pdf`);
}
