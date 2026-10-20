#!/usr/bin/env node
/** Lista y retira publicaciones propiedad de la sesión institucional. Sin Admin SDK ni claves privadas. */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function fail(message) { throw new Error(message); }
function collectRemoveArgs() {
  const refs = [];
  for (let i=0;i<args.length;i++) {
    if (args[i] !== '--remove') { if (args[i] !== '--list' && args[i] !== '--help' && args[i] !== '--orphans') fail('Argumento desconocido: ' + args[i]); continue; }
    const key=args[++i];
    if (!key || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key)) fail('Use --remove ID_GRUPO/ID_PUBLICACION');
    if (refs.includes(key)) fail('La publicación ' + key + ' está repetida.');
    refs.push(key);
  }
  if (refs.length > 300) fail('Seleccione máximo 300 publicaciones por operación.');
  return refs;
}
function envConfig() {
  const path=resolve(appRoot,'.env.local');
  if(!existsSync(path)) fail('Falta .env.local en el proyecto. No se ejecutó ninguna operación.');
  const vals={};
  for (const line of readFileSync(path,'utf8').split(/\r?\n/)) {
    const m=line.match(/^\s*(?:export\s+)?(VITE_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if(m){let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);vals[m[1]]=v;}
  }
  for(const key of ['API_KEY','AUTH_DOMAIN','PROJECT_ID','APP_ID','MESSAGING_SENDER_ID'])if(!vals['VITE_FIREBASE_'+key])fail('Falta configuración Firebase '+key);
  if(vals.VITE_FIREBASE_PROJECT_ID !== 'nodos-educativos-researchudg')fail('Proyecto Firebase distinto al esperado.');
  return {apiKey:vals.VITE_FIREBASE_API_KEY,authDomain:vals.VITE_FIREBASE_AUTH_DOMAIN,projectId:vals.VITE_FIREBASE_PROJECT_ID,appId:vals.VITE_FIREBASE_APP_ID,messagingSenderId:vals.VITE_FIREBASE_MESSAGING_SENDER_ID};
}
async function ask(prompt) { const io=createInterface({input:process.stdin,output:process.stdout});try{return (await io.question(prompt)).trim();}finally{io.close();} }
async function secret() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode!=='function') fail('Use una terminal interactiva; no redirija contraseñas.');
  process.stdout.write('Contraseña de Nodos Educativos (no aparecerá): ');
  return new Promise((resolve,reject)=>{
    const stdin=process.stdin;let value='';
    stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
    const finish=()=>{stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();process.stdout.write('\n');};
    function onData(input) {for(const char of input){if(char==='\u0003'){finish();reject(new Error('Cancelado.'));return;}if(char==='\r'||char==='\n'){finish();resolve(value);return;}if(char==='\b'||char==='\u007f'){value=value.slice(0,-1);continue;}if(char>=' '&&value.length<300)value+=char;}}
    stdin.on('data',onData);
  });
}
function safeTimestamp(value){return value?.seconds != null ? `${value.seconds}:${value.nanoseconds||0}` : null;}
async function main() {
  if(args.includes('--help')) {console.log('USO:\n  node scripts/limpiar-publicaciones-2d.mjs --list\n  node scripts/limpiar-publicaciones-2d.mjs --orphans\n  node scripts/limpiar-publicaciones-2d.mjs --remove GRUPO/PUBLICACION\n  node scripts/limpiar-publicaciones-2d.mjs --remove GRUPO/ID1 --remove GRUPO/ID2');return;}
  const targets=collectRemoveArgs();
  const orphanMode=args.includes('--orphans');
  if(orphanMode && targets.length)fail('No mezcle --orphans con --remove.');
  const config=envConfig();
  const { initializeApp, deleteApp }=await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword, signOut }=await import('firebase/auth');
  const { getFirestore, doc, getDoc, getDocs, collection, runTransaction }=await import('firebase/firestore');
  const app=initializeApp(config,`nodos-limpieza-${process.pid}`);
  const auth=getAuth(app);let authenticated=false;
  try {
    if(!process.stdin.isTTY)fail('Use una terminal interactiva.');
    const email=(await ask('Correo institucional de Nodos Educativos: ')).trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Correo incorrecto. No se modificó nada.');
    const password=await secret();
    try {await signInWithEmailAndPassword(auth,email,password);authenticated=true;}catch{fail('Autenticación fallida. No se modificó nada.');}
    const user=auth.currentUser;
    if(!user || !user.emailVerified || user.email?.toLowerCase()!==email)fail('Necesita iniciar sesión con su cuenta verificada.');
    const db=getFirestore(app);
    const access=await getDoc(doc(db,'access',user.uid));
    const role=access.data()?.role;
    if(!access.exists()||access.data()?.active!==true||!['admin','professor'].includes(role))fail('La gestión de publicaciones requiere rol investigador/administrador activo.');
    console.log(`\nSesión verificada. Rol ${role}. Se mostrarán SOLAMENTE publicaciones de su UID.`);
    let groups=[];let inactive=0;
    if(role==='admin') {
      const snap=await getDocs(collection(db,'groups'));
      const all=snap.docs.map(d=>({id:d.id,name:d.data().name||d.id,active:d.data().active===true}));
      groups=all.filter(x=>x.active);inactive=all.length-groups.length;
    }else {
      const memberships=await getDocs(collection(db,'memberships',user.uid,'groups'));
      for(const membership of memberships.docs.filter(d=>d.data().active===true)) {
        const g=await getDoc(doc(db,'groups',membership.id));
        if(g.exists()&&g.data().active===true)groups.push({id:g.id,name:g.data().name||g.id});
      }
    }
    const items=[];
    for(const g of groups){
      const results=await getDocs(collection(db,'groupPublications',g.id,'diagrams'));
      for(const snap of results.docs){
        const data=snap.data();
        if(data.ownerUid !== user.uid)continue;
        items.push({key:g.id+'/'+snap.id,groupId:g.id,id:snap.id,group:g.name,title:String(data.title||'Sin título'),sourceDiagramId:String(data.sourceDiagramId||snap.id),timestamp:safeTimestamp(data.updatedAt),data});
      }
    }
    items.sort((a,b)=>a.title.localeCompare(b.title,'es')||a.group.localeCompare(b.group,'es'));
    const draftIds=new Map();
    for(const item of items){
      if(!draftIds.has(item.sourceDiagramId)) {
        const snapshot=await getDoc(doc(db,'users',user.uid,'diagrams',item.sourceDiagramId));
        draftIds.set(item.sourceDiagramId,snapshot.exists());
      }
      item.orphan=!draftIds.get(item.sourceDiagramId);
    }
    console.log(`\nPUBLICACIONES SUYAS EN PROGRAMAS ACTIVOS: ${items.length}`);
    for(const p of items){
      const identical=items.filter(x=>x.title.toLocaleLowerCase('es')===p.title.toLocaleLowerCase('es'));
      console.log(`\n${p.title}\n  Programa: ${p.group}\n  Clave: ${p.key}${p.orphan?'\n  ESTADO: borrador original eliminado':''}${identical.length>1?'\n  Nota: este título aparece en '+identical.length+' programas/publicaciones':''}`);
    }
    if(inactive)console.log(`\nAviso: ${inactive} programa(s) inactivo(s) no se pueden consultar con las reglas actuales; requieren revisión administrativa si se reactivan.`);
    if(!targets.length && !orphanMode) {console.log('\nVISTA PREVIA. No se modificó nada. Use --orphans para retirar únicamente publicaciones sin borrador original.');return;}
    const selected=orphanMode ? items.filter(p=>p.orphan) : targets.map(key=>{const p=items.find(i=>i.key===key);if(!p)fail('No se encontró una publicación PROPIA y accesible: '+key+'. No se modificó nada.');return p;});
    if(!selected.length){console.log('No hay publicaciones huérfanas accesibles. No se modificó nada.');return;}
    console.log(`\nSE RETIRARÁN ${selected.length} PUBLICACIÓN(ES). Ningún borrador ni otra publicación será eliminado.`);
    selected.forEach(x=>console.log('  · '+x.key+' — '+x.group+' — '+x.title));
    const answer=await ask(`Escriba RETIRAR ${selected.length} para confirmar: `);
    if(answer!==`RETIRAR ${selected.length}`){console.log('Cancelado. No se modificó nada.');return;}
    const backupDir=resolve(homedir(),'Projects/ResearchUDG/respaldos-publicaciones');
    mkdirSync(backupDir,{recursive:true,mode:0o700});
    const filename=resolve(backupDir,'nodos-copias-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
    writeFileSync(filename,JSON.stringify({uid:user.uid,savedAt:new Date().toISOString(),publications:selected.map(p=>({key:p.key,document:p.data}))},null,2),{mode:0o600,flag:'wx'});
    console.log('Respaldo local de las publicaciones seleccionadas: '+filename);
    await runTransaction(db,async tx=>{
      const refs=selected.map(p=>doc(db,'groupPublications',p.groupId,'diagrams',p.id));
      const snapshots=[];for(const ref of refs)snapshots.push(await tx.get(ref));
      for(let i=0;i<selected.length;i++){
        const actual=snapshots[i];const previous=selected[i];
        if(!actual.exists()||actual.data().ownerUid!==user.uid||actual.data().sourceDiagramId!==previous.sourceDiagramId||safeTimestamp(actual.data().updatedAt)!==previous.timestamp)
          fail('Una publicación fue modificada durante la revisión. No se eliminó nada; ejecute --list otra vez.');
      }
      refs.forEach(ref=>tx.delete(ref));
    });
    console.log(`RETIRADAS ${selected.length} publicación(es) de Firebase. Los borradores y publicaciones restantes siguen intactos.`);
  }finally{
    if(authenticated)await signOut(auth).catch(()=>{});
    await deleteApp(app).catch(()=>{});
  }
}
main().catch(error=>{console.error('ERROR:',error.message);process.exitCode=1;});
