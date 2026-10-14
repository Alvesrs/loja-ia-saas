'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('saved theme initializes before styles on every application page',()=>{
  let checked=0;
  for(const name of fs.readdirSync('public').filter(n=>n.endsWith('.html'))){
    const html=fs.readFileSync('public/'+name,'utf8');
    if(!/<head\b/i.test(html))continue;
    assert(html.includes('js/theme.js'),name+' lacks saved-theme initialization');
    const theme=html.indexOf('js/theme.js'),css=html.search(/<link\b[^>]*rel=["']stylesheet["']/i);
    assert(css<0||theme<css,name+' initializes styles before saved theme');
    assert.equal((html.match(/js\/theme\.js/g)||[]).length,1,name+' duplicates theme initialization');checked++;
  }
  assert(checked>=10);
});
