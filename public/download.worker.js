importScripts(["./crypto-js.min.js"]);
importScripts(["./service.js"]);

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

const downloadData = {
  // id: {
  //   status: "ready" | "reading" | "done",
  //   name: "name",
  //   size: 0,
  //   buffer: [],
  // }
};

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // 拦截保存文件的url请求
  if (url.includes("/savefile/")) {
    const id = url.substring(url.lastIndexOf("/") + 1);

    if (downloadData[id]?.status === "ready") {
      event.respondWith(
        new Response(
          new ReadableStream({
            start() {
              downloadData[id].status = "reading";
            },
            async pull(controller) {
              // 等待数据产生
              while (!downloadData[id].buffer) {
                if (downloadData[id].status === "done") {
                  // 传输完成
                  controller.close();
                  downloadData[id] = null;
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
              // 消费数据
              const data = new Uint8Array(downloadData[id].buffer);
              downloadData[id].buffer = null;
              controller.enqueue(data);
            },
            cancel() {
              // 用户取消了，删掉这个id
              downloadData[id] = null;
            },
          }),
          {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": downloadData[id].size,
              "Content-Disposition":
                "attachment; filename*=utf-8''" +
                encodeURIComponent(downloadData[id].name),
            },
          }
        )
      );
    }
  }
});

self.addEventListener("message", async (event) => {
  if (event.data.type === "DOWNLOAD") {
    const { id, name, size } = event.data;
    downloadData[id] = {
      status: "ready",
      name,
      size,
      buffer: null,
    };
    event.source.postMessage({ type: "READY" });
  } else if (event.data.type === "FILE") {
    const { id, buffer } = event.data;
    if (downloadData[id]) {
      downloadData[id].buffer = buffer;
      // 等待数据被消费
      while (!downloadData[id].buffer) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      event.source.postMessage({ type: "PULL" });
    } else {
      // 用户取消了
      event.source.postMessage({ type: "CANCEL" });
    }
  } else if (event.data.type === "DONE") {
    if (downloadData[event.data.id])
      downloadData[event.data.id].status = "done";
  }
});
