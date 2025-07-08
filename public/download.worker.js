importScripts(["./crypto-js.min.js"]);
importScripts(["./service.js"]);

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

let fileInfo = null;
let password = null;

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/savefile") && fileInfo && password) {
    // 消费数据，避免密码被重复使用
    const _fileInfo = Object.assign({}, fileInfo);
    const _password = password;
    fileInfo = null;
    password = null;

    event.respondWith(
      new Response(
        new ReadableStream({
          index: 0,
          async pull(controller) {
            try {
              const buffer = await downloadAndDecrypt(
                _fileInfo.hashs[this.index++],
                _password
              );
              controller.enqueue(new Uint8Array(buffer));
            } catch (error) {
              console.error(error);
              controller.close();
            }
            if (this.index >= _fileInfo.hashs.length) {
              controller.close();
            }
          },
        }),
        {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": _fileInfo.size,
            "Content-Disposition":
              "attachment; filename*=utf-8''" +
              encodeURIComponent(_fileInfo.name),
          },
        }
      )
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data.type === "FILE") {
    fileInfo = event.data.fileInfo;
    password = event.data.password;
    event.source.postMessage({ type: "READY" });
  }
});
