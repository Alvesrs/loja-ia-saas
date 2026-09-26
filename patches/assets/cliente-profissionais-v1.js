(function(){
  function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
  const nomesDias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  let profissionaisCache=[];

  async function carregarProfissionais(){
    profissionaisCache=await apiFetch('/lojas/'+loja.id+'/cliente-hub/profissionais');
    return profissionaisCache;
  }

  function servicosChecks(selecionados){
    const ids=new Set(selecionados||[]);
    const sv=(resumo.servicos||[]).filter(s=>s.ativo!==false);
    if(!sv.length)return '<div class="muted">Cadastre seus trabalhos antes de vincular serviços à equipe.</div>';
    return '<div class="pro-services">'+sv.map(s=>'<label class="check"><input type="checkbox" data-pro-sv="'+safe(s.id)+'" '+(ids.has(s.id)?'checked':'')+'> '+safe(s.nome)+'</label>').join('')+'</div>';
  }

  function horariosEditor(horarios){
    const hs=horarios||{};
    return '<div class="days" id="pro-days">'+nomesDias.map((n,i)=>{
      const x=hs[String(i)]||{};
      return '<div class="day" data-pro-day="'+i+'"><label><input class="pro-open" type="checkbox" '+(x.aberto===true?'checked':'')+'> '+n+'</label><input class="pro-ini" type="time" value="'+safe(x.inicio||'09:00')+'"><input class="pro-fim" type="time" value="'+safe(x.fim||'18:00')+'"></div>';
    }).join('')+'</div>';
  }

  function lerHorarios(){
    const usar=$('pro-geral').checked;
    if(usar)return null;
    const horarios={};
    document.querySelectorAll('[data-pro-day]').forEach(row=>{
      horarios[row.dataset.proDay]={
        aberto:row.querySelector('.pro-open').checked,
        inicio:row.querySelector('.pro-ini').value,
        fim:row.querySelector('.pro-fim').value
      };
    });
    return horarios;
  }

  function selecionados(){
    return Array.from(document.querySelectorAll('[data-pro-sv]:checked')).map(x=>x.dataset.proSv);
  }

  function formProfissional(p){
    const edit=!!p;
    $('content').innerHTML=
      '<div class="pro-head"><div><h2>'+(edit?'Editar profissional':'Adicionar profissional')+'</h2><p class="muted">Defina quem atende, quais serviços realiza e os horários dessa pessoa.</p></div>'+(edit?'<button class="mini" id="pro-cancel-edit">Cancelar edição</button>':'')+'</div>'+
      '<div class="field"><label>Nome do profissional</label><input id="pro-nome" maxlength="100" placeholder="Ex.: Ana" value="'+safe(p?.nome||'')+'"></div>'+
      '<div class="field"><label>Serviços que realiza</label>'+servicosChecks(p?.servico_ids||[])+'<div class="muted">Se nenhum serviço for marcado, o profissional será considerado disponível para todos.</div></div>'+
      '<label class="check" style="margin-top:14px"><input id="pro-geral" type="checkbox" '+(!p?.horarios?'checked':'')+'> Usar os horários gerais da empresa</label>'+
      '<div id="pro-horarios" '+(!p?.horarios?'class="hidden"':'')+'>'+horariosEditor(p?.horarios||null)+'</div>'+
      '<div class="btns"><button class="btn" id="pro-save">'+(edit?'Salvar alterações':'Adicionar profissional')+'</button></div>'+
      '<div class="status" id="pro-status"></div>'+
      '<div id="pro-list-wrap"></div>';

    $('pro-geral').onchange=()=>$('pro-horarios').classList.toggle('hidden',$('pro-geral').checked);
    if(edit&&$('pro-cancel-edit'))$('pro-cancel-edit').onclick=()=>renderEquipeProfissionais();

    $('pro-save').onclick=async()=>{
      const st=$('pro-status'),btn=$('pro-save');
      try{
        btn.disabled=true;st.textContent='Salvando…';
        const body={nome:$('pro-nome').value.trim(),servico_ids:selecionados(),horarios:lerHorarios()};
        if(edit){
          await apiFetch('/lojas/'+loja.id+'/cliente-hub/profissionais/'+p.id,{method:'PUT',body:JSON.stringify(body)});
        }else{
          await apiFetch('/lojas/'+loja.id+'/cliente-hub/profissionais',{method:'POST',body:JSON.stringify(body)});
        }
        await carregarProfissionais();
        await refreshResumo();
        await recarregarProgresso();
        renderEquipeProfissionais();
      }catch(e){st.textContent=e.message||'Não foi possível salvar o profissional.'}
      finally{btn.disabled=false}
    };
    renderLista();
  }

  function renderLista(){
    const wrap=$('pro-list-wrap');if(!wrap)return;
    const ativos=profissionaisCache.filter(p=>p.ativo!==false);
    wrap.innerHTML='<div class="pro-list-title">Equipe cadastrada</div>'+
      (ativos.length?ativos.map(p=>{
        const nomes=(p.servico_ids||[]).map(id=>(resumo.servicos||[]).find(s=>s.id===id)?.nome).filter(Boolean);
        return '<div class="pro-card"><div><div class="item-title">'+safe(p.nome)+'</div><div class="item-sub">'+(nomes.length?safe(nomes.join(', ')):'Todos os serviços')+' · '+(p.horarios?'Horário próprio':'Horário geral')+'</div></div><div class="pro-actions"><button class="mini" data-pro-edit="'+p.id+'">Editar</button><button class="delete" data-pro-off="'+p.id+'">Desativar</button></div></div>';
      }).join(''):'<div class="muted" style="margin-top:12px">Nenhum profissional cadastrado.</div>');
    wrap.querySelectorAll('[data-pro-edit]').forEach(b=>b.onclick=()=>formProfissional(profissionaisCache.find(p=>p.id===b.dataset.proEdit)));
    wrap.querySelectorAll('[data-pro-off]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Desativar este profissional? Os agendamentos já existentes serão preservados.'))return;
      try{await apiFetch('/lojas/'+loja.id+'/cliente-hub/profissionais/'+b.dataset.proOff,{method:'DELETE'});await carregarProfissionais();await recarregarProgresso();renderEquipeProfissionais()}catch(e){alert(e.message||'Não foi possível desativar.')}
    });
  }

  async function renderEquipeProfissionais(){
    $('content').innerHTML='<h2>Equipe</h2><div class="muted">Carregando profissionais…</div>';
    try{await carregarProfissionais();formProfissional(null)}catch(e){$('content').innerHTML='<h2>Equipe</h2><div class="muted">'+safe(e.message||'Não foi possível carregar a equipe.')+'</div>'}
  }

  function ativar(){
    try{
      if(typeof renderEtapa!=='function'||typeof etapaAtual!=='function')return false;
      if(window.__saintsProfessionalsV1)return true;
      window.__saintsProfessionalsV1=true;
      const anterior=renderEtapa;
      renderEtapa=async function(){
        const atual=etapaAtual();
        if(atual&&atual.id==='equipe')return renderEquipeProfissionais();
        return anterior();
      };
      if(typeof loja!=='undefined'&&loja&&etapaAtual().id==='equipe')renderEquipeProfissionais();
      return true;
    }catch(_){return false}
  }
  if(!ativar()){let n=0;const t=setInterval(()=>{if(ativar()||++n>30)clearInterval(t)},200)}
})();