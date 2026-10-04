// Dev-only static server for storage tests (localStorage needs a real origin;
// file:// is opaque). Node builtins only — no new dependencies. Ephemeral port.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function startServer(root) {
  const dir = path.resolve(root || path.resolve(__dirname, '..'));
  const server = http.createServer(function (req, res) {
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch (e) {
      res.writeHead(400); res.end('bad request'); return;
    }
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(dir, rel);
    if (filePath !== dir && !filePath.startsWith(dir + path.sep)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.readFile(filePath, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const type = path.extname(filePath) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      const port = server.address().port;
      resolve({
        url: 'http://127.0.0.1:' + port + '/index.html',
        close: function () {
          return new Promise(function (r) {
            server.closeAllConnections?.();
            server.close(r);
          });
        },
      });
    });
  });
}

module.exports = { startServer };
