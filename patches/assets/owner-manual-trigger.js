const normalizarApresentacao=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();
async function saidaDono(evento){
 const intro=require('./ownerSalesPrompt').INTRO;
 if(evento.fromMe!==true||evento.source==='api'||!intro||normalizarApresentacao(evento.texto)!==normalizarApresentacao(intro))return saidaDonoAnterior(evento);
 if(!/^\d+@(c\.us|lid)$/.test(String(evento.contato||'')))return 'conversa_pessoal_ignorada';
 const {data:cfg,error}=await db.from('whatsapp_configuracoes').select('id,loja_id').eq('provedor','waha').eq('identificador_externo',evento.destinatarioId).eq('ativo',true).limit(1).maybeSingle();if(error)throw error;if(!cfg)return null;
 const l=await loja(cfg.loja_id);if(!ownerId()||l?.dono_id!==ownerId())return null;
 const now=new Date().toISOString();
 const {error:e}=await db.from('saintsai_sales_conversations').upsert({session_id:evento.destinatarioId,contato:evento.contato,loja_id:l.id,configuracao_id:cfg.id,ativo:true,ativado_em:now,atualizado_em:now,ultimo_evento_id:'prospeccao:iniciado:manual:'+String(evento.idExterno||Date.now())},{onConflict:'session_id,contato'});if(e)throw e;
 return 'abordagem_manual_autorizada';
}
