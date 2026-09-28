const fs=require('node:fs');
const cp=require('node:child_process');
const file='src/services/agendaWhatsapp.service.js';
let code=fs.readFileSync(file,'utf8');
const anchor="      return 'Aqui está um novo link para escolher o serviço e o horário. Na página, selecione Pix para gerar a cobrança: '+link;\n    }\n  }";
if(!code.includes(anchor))throw new Error('Fluxo de link do atendimento não encontrado');
code=code.replace(anchor,anchor.replace("    }\n  }",`    }
    return 'Ainda não consigo gerar um link de pagamento para este atendimento: a agenda e as opções de escolha da empresa precisam estar configuradas. Peça ao responsável para concluir a configuração antes de tentar novamente.';
  }`));
fs.writeFileSync(file,code);
cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
