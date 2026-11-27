// Correcciones de chats: solo la interpretación confirmada pasa a lección pendiente.
export function registerCorrectionTools(server,z,db){
 const uuid=z.uuid(),kind=z.enum(['technical','workflow','preference','lesson']),scope=z.enum(['work','general']);
 const fields='id,source_project,source_chat_url,source_message_key,work_id,work_name,kind,scope,original_correction,proposed_interpretation,rationale,applicability,status,user_feedback,linked_learning_id,version,created_at,updated_at,confirmed_at';
 const check=r=>{if(r.error)throw Error(r.error.message);return r.data};
 const defs=[
 ['elite_ai_capture_correction','Registrar corrección interpretada','Cuando el usuario corrija un criterio, registrar su frase y una interpretación provisional; dejarla pendiente de CONFIRMACIÓN, nunca aprobar ni ejecutar la lección. Pedir luego al usuario si la interpretación es correcta.',false,
 z.object({operation_id:uuid,source_project:z.string().max(160).default('Élite Teoría'),source_chat_url:z.string().max(2048).default(''),source_message_key:z.string().max(250).default(''),work_id:uuid.nullable().default(null),work_name:z.string().max(160).default(''),kind,scope,original_correction:z.string().trim().min(1).max(12000),proposed_interpretation:z.string().trim().min(1).max(20000),rationale:z.string().max(20000).default(''),applicability:z.string().max(20000).default('')}).strict(),
 async a=>{
 const prev=check(await db.from('elite_ai_corrections').select(fields).eq('id',a.operation_id).maybeSingle());
 if(prev){if(prev.original_correction!==a.original_correction||prev.proposed_interpretation!==a.proposed_interpretation)throw Error('Identificador reutilizado con otra corrección.');return {correction:prev,created:false};}
 if(a.scope==='work'&&!a.work_id&&!a.work_name.trim())throw Error('Indica la obra de origen.');
 let wname=a.work_name.trim();
 if(a.work_id){const w=check(await db.from('elite_works').select('name').eq('id',a.work_id).maybeSingle());if(!w)throw Error('Obra no disponible.');wname=w.name;}
 const {operation_id,...input}=a;
 const saved=check(await db.from('elite_ai_corrections').insert({...input,id:operation_id,work_name:wname}).select(fields).single());
 return {correction:saved,created:true,message:'Interpretación guardada como pendiente. Pregunta si la entendiste correctamente.'};
 }],
 ['elite_ai_list_corrections','Consultar correcciones pendientes','Lista correcciones capturadas y aún no confirmadas. No confundirlas con aprendizajes aprobados.',true,
 z.object({status:z.enum(['awaiting_confirmation','confirmed','dismissed','all']).default('awaiting_confirmation'),work_id:uuid.optional(),offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(50)}).strict(),
 async a=>{let q=db.from('elite_ai_corrections').select(fields,{count:'exact'}).order('created_at',{ascending:false});if(a.status!=='all')q=q.eq('status',a.status);if(a.work_id)q=q.eq('work_id',a.work_id);const r=await q.range(a.offset,a.offset+a.limit-1);return {corrections:check(r),count:r.count,offset:a.offset,limit:a.limit};}],
 ['elite_ai_resolve_correction','Confirmar interpretación o corregirla','Solo después de que el usuario confirme expresamente una interpretación. Confirmar crea un aprendizaje PENDIENTE de aprobación, nunca aprobado. Si el usuario la corrige, guardar nuevo texto y volver a preguntar. Descartar solo con permiso.',false,
 z.object({correction_id:uuid,expected_version:z.number().int().min(1),resolution:z.enum(['confirm','correct','dismiss']),revised_interpretation:z.string().trim().min(1).max(20000).nullable().optional(),feedback:z.string().max(5000).default('')}).strict(),
 async a=>check(await db.rpc('elite_ai_resolve_correction',{correction_id:a.correction_id,expected_version:a.expected_version,resolution:a.resolution,revised_interpretation:a.revised_interpretation??null,feedback:a.feedback}))],
 ['elite_ai_correction_history','Historial de una corrección','Muestra interpretaciones sucesivas y decisión. No borra ni modifica información.',true,
 z.object({correction_id:uuid,limit:z.number().int().min(1).max(100).default(30)}).strict(),
 async a=>{const c=check(await db.from('elite_ai_corrections').select(fields).eq('id',a.correction_id).maybeSingle());if(!c)throw Error('Corrección no encontrada');return {correction:c,versions:check(await db.from('elite_ai_correction_history').select('version,old_status,new_status,snapshot,created_at').eq('correction_id',c.id).order('version',{ascending:false}).limit(a.limit))}}]
 ];
 for(const [name,title,description,readOnly,schema,run] of defs){
 server.registerTool(name,{title,description,inputSchema:schema,annotations:{readOnlyHint:readOnly,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:'oauth2',scopes:[]}]},async a=>{
 try{const output=await run(a);return {content:[{type:'text',text:JSON.stringify(output)}],structuredContent:output};}
 catch(e){return {isError:true,content:[{type:'text',text:e instanceof Error?e.message:'Error en correcciones'}]}}
 });}
}
