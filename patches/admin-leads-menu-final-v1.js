const fs=require('node:fs');
const p='public/admin-mobile.html';
let h=fs.readFileSync(p,'utf8');

if(!h.includes("admin-leads.html")){
  const btn="  <button type=\"button\" onclick=\"location.href='admin-leads.html'\">🧠 LEADS / PROMPTS</button>\n";
  if(h.includes('</nav>')){
    h=h.replace('</nav>',btn+'  </nav>');
  }else{
    throw new Error('Menu final do painel SaintsAI não encontrado.');
  }
}

fs.writeFileSync(p,h);
console.log('Menu final SaintsAI atualizado com Leads / Prompts.');
