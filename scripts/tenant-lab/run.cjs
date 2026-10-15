'use strict';
// Run the compiled production code with no network, credentials or writable root filesystem.
const {spawnSync}=require('node:child_process');
const image=process.argv[2]||'saintsai-tenant-lab';
if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/@-]*$/.test(image))throw Error('Invalid local image name');
const files=['tests/tenant-dialogue-lab.test.cjs','tests/current-tenant-isolation.test.cjs','tests/tenant-human-control.test.cjs','tests/send-intent.test.cjs','tests/queue-durable-recovery.test.cjs','tests/booking-confirmation-idempotency.test.cjs'];
const r=spawnSync('docker',['run','--rm','--network','none','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--entrypoint','node',image,'--test','--test-reporter=tap',...files],{stdio:'inherit'});
if(r.error){console.error('Não foi possível executar o laboratório Docker:',r.error.code);process.exitCode=1;}else process.exitCode=r.status??1;
