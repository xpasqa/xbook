const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const root = __dirname;
const port = Number(process.env.PORT || 3001);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const filePath = resolveFilePath(pathname);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    response.writeHead(200, { "Content-Type": getContentType(filePath) });
    response.end(content);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Book Publion running at http://127.0.0.1:${port}/`);
});

function resolveFilePath(pathname) {
  if (pathname === "/") return path.join(root, "index.html");

  const directPath = safeJoin(pathname);
  if (directPath && fs.existsSync(directPath) && fs.statSync(directPath).isFile()) return directPath;

  if (!path.extname(pathname)) return path.join(root, "detail.html");

  return directPath || path.join(root, "404.html");
}

function safeJoin(pathname) {
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, normalized);
  return filePath.startsWith(root) ? filePath : null;
}

function getContentType(filePath) {
  const realPath = fs.realpathSync(filePath);
  const extension = path.extname(realPath) || path.extname(filePath);
  return mimeTypes[extension] || "application/octet-stream";
}
