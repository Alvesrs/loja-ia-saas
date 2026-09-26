
(function(){
  function safe(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function lerArquivoDataUrl(file){
    return new Promise(function(resolve,reject){
      var r=new FileReader();
      r.onload=function(){resolve(String(r.result||''));};
      r.onerror=function(){reject(new Error('Não foi possível ler a foto.'));};
      r.readAsDataURL(file);
    });
  }

  async function enviarFotoServico(file){
    if(!file)return {imagem_url:null,imagem_path:null};
    if(['image/jpeg','image/png','image/webp'].indexOf(file.type)<0)throw new Error('Use uma foto JPG, PNG ou WEBP.');
    if(file.size>3*1024*1024)throw new Error('A foto deve ter no máximo 3 MB.');
    var dataUrl=await lerArquivoDataUrl(file);
    return apiFetch('/lojas/'+loja.id+'/servico-imagem',{
      method:'POST',
      body:JSON.stringify({data_url:dataUrl})
    });
  }

  function renderServicosPolish(){
    var arr=resumo.servicos||[];
    $('content').innerHTML=
      '<h2>Cadastre seu trabalho</h2>'+
      '<p class="muted">Pode ser corte de cabelo, unha, consulta, instalação, produto ou qualquer outro serviço. A foto ajuda o cliente a reconhecer a opção.</p>'+
      '<div class="field"><label>Foto do trabalho</label><input id="sv-img" type="file" accept="image/jpeg,image/png,image/webp"><div id="sv-preview" class="service-preview"><span>Prévia da foto</span></div></div>'+
      '<div class="field"><label>Nome</label><input id="sv-nome" placeholder="Ex.: Corte degradê"></div>'+
      '<div class="field"><label>Descrição para a IA / WhatsApp</label><input id="sv-desc" placeholder="Ex.: acabamento, opções e detalhes"></div>'+
      '<div class="row"><div class="field"><label>Preço</label><input id="sv-preco" type="number" min="0" step=".01" placeholder="0,00"></div><div class="field"><label>Duração (min)</label><input id="sv-dur" type="number" min="5" value="30"></div></div>'+
      '<div class="field"><label>Intervalo depois (min)</label><input id="sv-int" type="number" min="0" value="0"></div>'+
      '<div class="btns"><button class="btn" id="sv-add">Adicionar trabalho</button></div>'+
      '<div class="status" id="sv-status"></div><div class="list" id="sv-list"></div>';

    var input=$('sv-img');
    input.onchange=function(){
      var f=input.files&&input.files[0];
      var p=$('sv-preview');
      if(!f){p.innerHTML='<span>Prévia da foto</span>';return;}
      var url=URL.createObjectURL(f);
      p.innerHTML='<img src="'+url+'" alt="Prévia">';
    };

    renderListaServicosPolish();

    $('sv-add').onclick=async function(){
      var st=$('sv-status'),btn=$('sv-add');
      try{
        btn.disabled=true;
        st.textContent='Salvando…';
        var foto=await enviarFotoServico($('sv-img').files&&$('sv-img').files[0]||null);
        await apiFetch('/lojas/'+loja.id+'/cliente-hub/servicos',{
          method:'POST',
          body:JSON.stringify({
            nome:$('sv-nome').value,
            descricao:$('sv-desc').value,
            preco:$('sv-preco').value,
            duracao_min:Number($('sv-dur').value),
            intervalo_pos_min:Number($('sv-int').value),
            imagem_url:foto.imagem_url,
            imagem_path:foto.imagem_path
          })
        });
        await refreshResumo();
        renderServicosPolish();
        await recarregarProgresso();
      }catch(e){
        st.textContent=e.message||'Não foi possível salvar.';
      }finally{
        btn.disabled=false;
      }
    };
  }

  function renderListaServicosPolish(){
    var el=$('sv-list');
    if(!el)return;
    var arr=resumo.servicos||[];
    el.innerHTML=arr.length?arr.map(function(s){
      var foto=s.imagem_url
        ? '<img class="service-thumb" src="'+safe(s.imagem_url)+'" alt="">'
        : '<div class="service-thumb service-empty">＋</div>';
      return '<div class="service-row">'+foto+
        '<div class="service-main"><div class="item-title">'+safe(s.nome)+'</div><div class="item-sub">'+dinheiro(s.preco)+' · '+Number(s.duracao_min||0)+' min'+(s.descricao?' · '+safe(s.descricao):'')+'</div></div>'+
        '<div class="service-actions"><button class="mini" data-photo="'+safe(s.id)+'">'+(s.imagem_url?'Trocar foto':'Adicionar foto')+'</button><button class="delete" data-del="'+safe(s.id)+'">Excluir</button></div>'+
      '</div>';
    }).join(''):'<div class="muted">Nenhum trabalho cadastrado ainda.</div>';

    el.querySelectorAll('[data-photo]').forEach(function(b){
      b.onclick=function(){
        var input=document.createElement('input');
        input.type='file';
        input.accept='image/jpeg,image/png,image/webp';
        input.onchange=async function(){
          var f=input.files&&input.files[0];
          if(!f)return;
          try{
            b.disabled=true;
            b.textContent='Enviando…';
            var foto=await enviarFotoServico(f);
            await apiFetch('/lojas/'+loja.id+'/cliente-hub/servicos/'+b.dataset.photo,{
              method:'PUT',
              body:JSON.stringify(foto)
            });
            await refreshResumo();
            renderServicosPolish();
            await recarregarProgresso();
          }catch(e){
            alert(e.message||'Não foi possível enviar a foto.');
          }finally{
            b.disabled=false;
          }
        };
        input.click();
      };
    });

    el.querySelectorAll('[data-del]').forEach(function(b){
      b.onclick=async function(){
        if(!confirm('Excluir este trabalho?'))return;
        await apiFetch('/lojas/'+loja.id+'/cliente-hub/servicos/'+b.dataset.del,{method:'DELETE'});
        await refreshResumo();
        renderServicosPolish();
        await recarregarProgresso();
      };
    });
  }

  function renderEquipePolish(){
    var atual=Number(resumo.agenda_config&&resumo.agenda_config.quantidade_profissionais||0);
    $('content').innerHTML=
      '<h2>Quantos profissionais atendem aqui?</h2>'+
      '<p class="muted">Informe a quantidade de pessoas que realizam atendimentos no local.</p>'+
      '<div class="field"><label>Número de profissionais</label><input id="eq-qtd" type="number" min="1" max="100" inputmode="numeric" value="'+(atual||1)+'"></div>'+
      '<div class="notice">Você pode alterar esse número sempre que sua equipe mudar.</div>'+
      '<div class="btns"><button class="btn" id="eq-save">Salvar equipe</button></div>'+
      '<div class="status" id="eq-status"></div>';

    $('eq-save').onclick=async function(){
      var st=$('eq-status'),btn=$('eq-save');
      try{
        btn.disabled=true;
        st.textContent='Salvando…';
        var x=await apiFetch('/lojas/'+loja.id+'/cliente-hub/equipe',{
          method:'PUT',
          body:JSON.stringify({quantidade_profissionais:Number($('eq-qtd').value)})
        });
        resumo.agenda_config=x;
        st.textContent='Equipe configurada.';
        await recarregarProgresso();
      }catch(e){
        st.textContent=e.message||'Não foi possível salvar.';
      }finally{
        btn.disabled=false;
      }
    };
  }

  function ativar(){
    try{
      if(typeof etapas==='undefined'||!Array.isArray(etapas))return false;
      if(!etapas.some(function(e){return e.id==='equipe';})){
        var pos=etapas.findIndex(function(e){return e.id==='servicos';});
        etapas.splice(pos+1,0,{id:'equipe',nome:'Equipe',titulo:'Equipe',desc:'Informe quantos profissionais atendem clientes no local.'});
      }

      renderServicos=renderServicosPolish;
      renderListaServicos=renderListaServicosPolish;

      if(!window.__saintsOriginalRenderEtapa){
        window.__saintsOriginalRenderEtapa=renderEtapa;
        renderEtapa=async function(){
          var atual=etapaAtual();
          if(atual&&atual.id==='equipe')return renderEquipePolish();
          return window.__saintsOriginalRenderEtapa();
        };
      }

      if(typeof loja!=='undefined'&&loja&&typeof resumo!=='undefined'&&resumo){
        renderTabs();
        renderEtapa();
      }
      return true;
    }catch(_){
      return false;
    }
  }

  if(!ativar()){
    var n=0;
    var t=setInterval(function(){
      n++;
      if(ativar()||n>30)clearInterval(t);
    },200);
  }
})();
