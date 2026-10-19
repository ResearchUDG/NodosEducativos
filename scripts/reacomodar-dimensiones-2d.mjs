#!/usr/bin/env node
/** Reacomoda el esquema real del coloquio en Firestore, con la propia cuenta.
 * No utiliza Admin SDK ni cambia roles, contenidos, nodos o conexiones.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { reacomodarDimensiones, estimarExtension, contarColisionesEstimadas, TITULO_ESPERADO, IDS_ESPERADOS } from './layout-dimensiones.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = flag => args.includes(flag);
const arg = flag => {const i = args.indexOf(flag); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null);};
const error = msg => { throw new Error(msg); };
const radio = arg('--radio') ? Number(arg('--radio')) : undefined;
const exterior = arg('--exterior') ? Number(arg('--exterior')) : undefined;
const groupId = arg('--group');
const diagramId = arg('--id');

function usage() {
  console.log(`USO:
  node scripts/reacomodar-dimensiones-2d.mjs --group ID --preview
  node scripts/reacomodar-dimensiones-2d.mjs --group ID --apply
  node scripts/reacomodar-dimensiones-2d.mjs --draft-only --apply
  node scripts/reacomodar-dimensiones-2d.mjs --file dimensiones-coloquio.json --output circular.json

Opciones: --id ID (si tiene esquemas de igual título), --radio 600 --exterior 1090.
Los datos y claves permanecen en su Mac. No ejecuta despliegues de GitHub ni cambios en reglas.`);
}
function envLocal() {
  const path = join(appRoot, '.env.local');
  if (!existsSync(path)) error('No se encontró app/.env.local. Ejecute el script desde la instalación configurada.');
  const out = Object.create(null);
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(VITE_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) { const v=match[2]; out[match[1]] = (/^(['"]).*\1$/.test(v) ? v.slice(1,-1) : v); }
  }
  for (const k of ['API_KEY','AUTH_DOMAIN','PROJECT_ID','APP_ID','MESSAGING_SENDER_ID']) {
    if (!out[`VITE_FIREBASE_${k}`]) error(`Falta VITE_FIREBASE_${k} en .env.local.`);
  }
  if (out.VITE_FIREBASE_PROJECT_ID !== 'nodos-educativos-researchudg') error('Proyecto Firebase inesperado. No se harán cambios.');
  return out;
}
async function ask(label) {
  const rl = createInterface({input: process.stdin, output: process.stdout});
  try { return (await rl.question(label)).trim(); } finally { rl.close(); }
}
async function hiddenPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') error('Use una Terminal interactiva.');
  process.stdout.write('Contraseña de Nodos Educativos (no aparecerá): ');
  return new Promise((resolvePromise,reject) => {
    const input = process.stdin; let password='';
    input.setRawMode(true); input.resume(); input.setEncoding('utf8');
    function cleanup() {input.off('data',onData);input.setRawMode(false);input.pause();process.stdout.write('\n');}
    function onData(chunk) {
      for(const c of chunk){
        if(c==='\u0003'){cleanup();reject(new Error('Cancelado por el usuario.'));return;}
        if(c==='\r'||c==='\n'){cleanup();resolvePromise(password);return;}
        if(c==='\u007f'||c==='\b'){password=password.slice(0,-1);continue;}
        if(c>=' '&&password.length<300)password+=c;
      }
    }
    input.on('data',onData);
  });
}
function stampKey(stamp) {
  return stamp && typeof stamp.seconds==='number' && typeof stamp.nanoseconds==='number' ? `${stamp.seconds}:${stamp.nanoseconds}` : '';
}
function stable(value) { // comparación independiente del orden de las claves de objetos
  if(Array.isArray(value))return value.map(stable);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function contentSignature(n) {return JSON.stringify(stable({id:n.id, type:n.type ?? 'concept', data:n.data}));}
function edgeSignature(e) {return JSON.stringify(stable(e));}
function assertPublicationUnchanged(draft, publication) {
  if (publication.title !== draft.title || publication.description !== draft.description) {
    error('El borrador y la edición publicada tienen títulos/descripciones distintos. No se actualizará automáticamente una edición diferente.');
  }
  if (!Array.isArray(publication.nodes) || !publication.nodes.length || !Array.isArray(publication.edges)) error('Publicación sin conceptos válidos.');
  const draftMap=new Map(draft.nodes.map(n=>[n.id,n]));
  const ids=new Set();
  for(const node of publication.nodes){
    if(ids.has(node.id))error('La publicación contiene nodos duplicados.');
    ids.add(node.id);
    if(!draftMap.has(node.id)||contentSignature(draftMap.get(node.id))!==contentSignature(node))
      error(`El contenido de «${node.id}» difiere entre borrador y publicación. Por seguridad no se publicarán cambios ajenos al diseño.`);
  }
  const selectedEdges=draft.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(edgeSignature).sort();
  const publishedEdges=publication.edges.map(edgeSignature).sort();
  if(JSON.stringify(selectedEdges)!==JSON.stringify(publishedEdges))
    error('Las relaciones del borrador y de la publicación no coinciden. Use el editor para publicar una versión editorial nueva.');
  return ids;
}
function toFormattedNodes(source){
  return source.nodes.map(n=>({id:n.id, type:'concept', position:{x:n.x,y:n.y},
    data:{title:n.title, description:n.description??'', category:n.category??'idea', ...(n.references?.length?{references:n.references}:{})}}));
}
function printPreview(before,after) {
  const old=estimarExtension(before), next=estimarExtension(after);
  const moved=before.filter((n,i)=>n.position.x!==after[i].position.x||n.position.y!==after[i].position.y).length;
  console.log(`\nCÍRCULO ACADÉMICO COMPACTO: ${after.length} nodos; ${moved} cambios de posición.`);
  console.log(`Extensión estimada anterior: ${old.ancho} × ${old.alto} px; nueva: ${next.ancho} × ${next.alto} px.`);
  console.log(`Colisiones geométricas aproximadas (250 × 300 px por tarjeta): ${contarColisionesEstimadas(after)}.`);
  for (const n of after) console.log(`  ${n.id.padEnd(24)} x=${String(n.position.x).padStart(5)} y=${String(n.position.y).padStart(5)}`);
  if (contarColisionesEstimadas(after)) error('Distribución con posibles superposiciones: no se escribirá nada.');
  return moved;
}
function backup(uid, diagramId, draft, groupId, pub) {
  const dir=join(homedir(),'Projects','ResearchUDG','respaldos');
  mkdirSync(dir,{recursive:true,mode:0o700});
  const now=new Date().toISOString().replace(/[:.]/g,'-');
  const path=join(dir,`dimensiones-antes-circulo-${diagramId}-${now}.json`);
  writeFileSync(path,JSON.stringify({authorUid:uid,diagramId,groupId:groupId??null,draft,publication:pub??null},null,2),{mode:0o600,flag:'wx'});
  console.log(`Respaldo privado creado: ${path}`);
}
async function main() {
  if(has('--help')||args.length===0) {usage();return;}
  if(has('--apply') && has('--preview')) error('Elija --apply o --preview.');
  if(has('--group')&&!groupId) error('--group requiere un ID.');
  if(has('--id')&&!diagramId) error('--id requiere un ID.');
  if(has('--file')) {
    if(has('--apply')||groupId||diagramId)error('--file es solo para preparar un archivo local; no escribe en Firebase.');
    const p=arg('--file'); if(!p)error('Indique --file RUTA.');
    const doc=JSON.parse(readFileSync(resolve(process.cwd(),p),'utf8'));
    const original=toFormattedNodes(doc), arranged=reacomodarDimensiones(original,{radio,radioExterior:exterior});
    printPreview(original,arranged);
    const output=arg('--output');
    if(output){const next={...doc,nodes:doc.nodes.map(n=>({...n,x:arranged.find(m=>m.id===n.id).position.x,y:arranged.find(m=>m.id===n.id).position.y}))};
      writeFileSync(resolve(process.cwd(),output),JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
      console.log(`Archivo alternativo generado (NO publicado): ${resolve(process.cwd(),output)}`);
    }
    return;
  }
  if(!has('--apply')&&!has('--preview'))error('Indique --preview o --apply para trabajar con Firebase.');
  if(!groupId&&!has('--draft-only'))error('Indique --group ID para actualizar publicación, o --draft-only para cambiar solo su borrador.');
  if(groupId&&has('--draft-only'))error('No combine --group con --draft-only.');
  if(!process.stdin.isTTY)error('Use una Terminal interactiva para autenticarse de forma privada.');
  const env=envLocal();
  const {initializeApp,deleteApp}=await import('firebase/app');
  const {getAuth,signInWithEmailAndPassword,signOut}=await import('firebase/auth');
  const {getFirestore,doc,collection,getDoc,getDocs,runTransaction,serverTimestamp}=await import('firebase/firestore');
  const app=initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID,messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID},`nodos-circular-${process.pid}`);
  const auth=getAuth(app);let logged=false;
  try {
    const email=(await ask('Correo institucional de Nodos Educativos: ')).toLowerCase();
    const pass=await hiddenPassword();
    try{await signInWithEmailAndPassword(auth,email,pass);logged=true;}catch{error('No se pudo iniciar sesión. No se modificó nada.');}
    const user=auth.currentUser;
    const domains=JSON.parse(readFileSync(join(appRoot,'security','email-domains.json'),'utf8')).domains;
    if(!user||!user.emailVerified||user.email?.toLowerCase()!==email||!domains.some(x=>email.endsWith('@'+x)))error('Correo institucional verificado requerido.');
    const db=getFirestore(app);
    const access=await getDoc(doc(db,'access',user.uid));
    if(!access.exists()||access.data().active!==true)error('Su cuenta no tiene acceso activo.');
    const role=access.data().role;
    if(groupId&&role!=='admin'&&role!=='professor')error('Solo profesores y administradores pueden publicar.');
    console.log(`\nSesión verificada con su usuario. Rol: ${role}.`);
    let ref;
    if(diagramId)ref=doc(db,'users',user.uid,'diagrams',diagramId);
    else {
      const all=await getDocs(collection(db,'users',user.uid,'diagrams'));
      const matches=all.docs.filter(d=>d.data().title===TITULO_ESPERADO);
      if(!matches.length)error(`No se encontró el esquema titulado «${TITULO_ESPERADO}» en su cuenta.`);
      if(matches.length>1)error(`Hay ${matches.length} esquemas con ese título. Ejecute con --id <ID> para elegir: ${matches.map(d=>d.id).join(', ')}`);
      ref=matches[0].ref;
    }
    const draftSnap=await getDoc(ref);
    if(!draftSnap.exists())error('Borrador no encontrado.');
    const draft=draftSnap.data();
    if(draft.title!==TITULO_ESPERADO)error('El esquema seleccionado no coincide con el título esperado.');
    if(!Array.isArray(draft.edges)||draft.edges.length!==19)error('Se esperaban 19 conexiones originales; no se modificará un esquema diferente.');
    const revised=reacomodarDimensiones(draft.nodes,{radio,radioExterior:exterior});
    console.log(`\nEsquema existente: ${draft.title} (ID ${ref.id}).`);
    const draftMoves=printPreview(draft.nodes,revised);
    let pubRef=null,pub=null,pubTimestamp='';let publishedMoves=0;
    if(groupId){
      pubRef=doc(db,'groupPublications',groupId,'diagrams',ref.id);
      const pubSnap=await getDoc(pubRef);
      if(!pubSnap.exists())error('No existe una edición publicada para este esquema en el grupo indicado. Se detiene sin cambios.');
      pub=pubSnap.data();
      if(pub.ownerUid!==user.uid||pub.sourceDiagramId!==ref.id)error('La publicación no pertenece a este borrador y usuario.');
      const allowed=assertPublicationUnchanged(draft,pub);
      publishedMoves=pub.nodes.filter(n=>{
        const target=revised.find(x=>x.id===n.id);
        return target.position.x!==n.position.x||target.position.y!==n.position.y;
      }).length;
      pubTimestamp=stampKey(pub.updatedAt);
      console.log(`Edición encontrada: grupo ${groupId}, ${allowed.size} conceptos visibles, ${publishedMoves} posiciones por actualizar.`);
    }
    if(!draftMoves&&!publishedMoves){console.log('El esquema y la publicación ya están en la distribución circular solicitada. Sin cambios.');return;}
    if(has('--preview')){console.log('VISTA PREVIA COMPLETA. No se escribió en Firestore.');return;}
    const operation=groupId?'CIRCULO Y PUBLICAR':'CIRCULO PRIVADO';
    console.log('\nSe conservarán exactamente los mismos nodos, enlaces y referencias. Se creará una revisión privada.');
    if(groupId)console.log('La publicación mantendrá el mismo enlace y el mismo conjunto de nodos visibles.');
    if(await ask(`Escriba ${operation} para confirmar: `)!==operation){console.log('Cancelado sin cambios.');return;}
    backup(user.uid,ref.id,draft,groupId,pub);
    const baselineRef=doc(db,'users',user.uid,'diagrams',ref.id,'revisions','baseline');
    const revisions=collection(db,'users',user.uid,'diagrams',ref.id,'revisions');
    const versionRef=doc(revisions);
    const oldKey=stampKey(draft.updatedAt);
    if(!oldKey)error('El esquema no tiene marca de actualización válida. Sin cambios.');
    try {
      await runTransaction(db,async tx=>{
        const current=await tx.get(ref);
        const baseline=await tx.get(baselineRef);
        if(!current.exists()||stampKey(current.data().updatedAt)!==oldKey)error('El borrador cambió mientras preparábamos el esquema. No se guardó nada.');
        if(!baseline.exists())tx.set(baselineRef,{title:draft.title,description:draft.description,nodes:draft.nodes,edges:draft.edges,
          kind:'baseline',authorUid:user.uid,savedAt:serverTimestamp()});
        tx.set(versionRef,{title:draft.title,description:draft.description,nodes:revised,edges:draft.edges,
          kind:'save',authorUid:user.uid,savedAt:serverTimestamp()});
        tx.update(ref,{nodes:revised,updatedAt:serverTimestamp()});
      });
      console.log(`Borrador y nueva versión guardados (revisión: ${versionRef.id}).`);
    }catch(e){error(`Fallo en el guardado privado: ${e.message}. No se intentó cambiar la publicación.`);}
    if(pubRef){
      try{
        const saved=await getDoc(versionRef);
        if(!saved.exists()||!saved.data().savedAt)error('La nueva revisión no está disponible.');
        await runTransaction(db,async tx=>{
          const current=await tx.get(pubRef);
          if(!current.exists()||current.data().ownerUid!==user.uid||stampKey(current.data().updatedAt)!==pubTimestamp)
            error('La publicación cambió durante el proceso. No se sobrescribió.');
          const visible=new Set(pub.nodes.map(n=>n.id));
          tx.update(pubRef,{nodes:revised.filter(n=>visible.has(n.id)),edges:draft.edges.filter(e=>visible.has(e.source)&&visible.has(e.target)),
            sourceRevisionId:versionRef.id,sourceRevisionSavedAt:saved.data().savedAt,
            updatedAt:serverTimestamp()});
        });
        console.log('PUBLICACIÓN ACTUALIZADA: mismo enlace, nuevo diseño circular.');
        console.log(`Abrir publicación: https://researchudg.github.io/NodosEducativos/#/publicacion/${groupId}/${ref.id}`);
      }catch(e){console.error(`ATENCIÓN: el borrador SÍ quedó guardado, pero NO se actualizó la publicación: ${e.message}. Puede volver a ejecutar el comando tras comprobarla.`);process.exitCode=1;return;}
    }
    console.log(`Abrir editor: https://researchudg.github.io/NodosEducativos/#/esquema/${ref.id}`);
  } finally {
    if(logged)await signOut(auth).catch(()=>{});
    await deleteApp(app).catch(()=>{});
  }
}
main().catch(e=>{console.error(`ERROR: ${e.message}`);process.exitCode=1;});
