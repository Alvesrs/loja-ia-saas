'use strict';const fs=require('node:fs'),p='src/server.js';let s=fs.readFileSync(p,'utf8');
const lines=s.split('\n');const removed=lines.filter(l=>l.includes("setTimeout(()=>require('../patches/verify-and-clean-clients-20261007.js')")||l.includes("setTimeout(()=>require('./services/chatterboxTestOnce.service').run()"));
if(removed.length){s=lines.filter(l=>!removed.includes(l)).join('\n');s+='\n// One-off cleanup and outbound test scripts require explicit execution; never run them on startup.\n';fs.writeFileSync(p,s);}
else if(!s.includes('// One-off cleanup and outbound test scripts'))throw Error('Startup side-effect anchors missing');
