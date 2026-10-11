import {spawn} from 'node:child_process';
export function run(command,args,{env=process.env,timeout=120000}={}) {
 return new Promise(resolve=>{
  const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',error;
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const timer=setTimeout(()=>{error=new Error('Command timed out');child.kill('SIGTERM');},timeout);
  child.on('error',e=>{error=e;});child.on('close',(status,signal)=>{clearTimeout(timer);resolve({status,signal,error,stdout,stderr});});
 });
}
