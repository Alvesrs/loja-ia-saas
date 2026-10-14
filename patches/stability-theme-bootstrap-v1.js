'use strict';
const fs = require('node:fs');
for (const name of fs.readdirSync('public').filter(name => name.endsWith('.html'))) {
  const file = 'public/' + name;
  let html = fs.readFileSync(file, 'utf8');
  const theme = html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/theme\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/i);
  const bootstrap = theme ? theme[0] : '<script src="js/theme.js"></script>';
  if (theme) html = html.replace(theme[0], '');
  html = html.replace(/<head\b[^>]*>/i, head => head + bootstrap);
  fs.writeFileSync(file, html);
}
