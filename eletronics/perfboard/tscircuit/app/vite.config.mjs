import {defineConfig} from 'vite';
export default defineConfig({root:new URL('.',import.meta.url).pathname,build:{outDir:'dist',emptyOutDir:true},server:{host:'127.0.0.1',port:5173,proxy:{'/api':'http://127.0.0.1:8080'}}});
