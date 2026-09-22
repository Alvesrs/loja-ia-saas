const http = require('http');

const TARGET = 'http://backend-prod.railway.internal:8080';
const OLD_PUBLIC = 'https://backend-prod-production-f338.up.railway.app';

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];

    const upstream = await fetch(TARGET + req.url, {
      method: req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : body,
      redirect: 'manual'
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (['transfer-encoding','content-encoding','content-length'].includes(key.toLowerCase())) return;
      if (key.toLowerCase() === 'location' && value.startsWith(OLD_PUBLIC)) {
        value = value.replace(OLD_PUBLIC, '');
      }
      try { res.setHeader(key, value); } catch (_) {}
    });

    const data = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('content-length', String(data.length));
    res.end(data);
  } catch (_) {
    res.statusCode = 502;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('SaintsAI temporariamente indisponível.');
  }
});

const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0', () => console.log('mobile proxy na porta ' + port));
