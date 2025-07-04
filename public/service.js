const DEFAULT_CHUNCK_SIZE = 5 * 1024 * 1024; // 默认分片大小：5MB
const BIG_FILE_SIZE = 50 * 1024 * 1024; // 大文件将使用流式下载方案：50MB

// 上传文件
async function uploadFile({ blob, hash, expire, onProgress }) {
  // 先查询是否已上传
  const resRefresh = await (
    await fetch("/api/refresh", {
      method: "post",
      body: JSON.stringify({ hash, expire }),
      headers: {
        "x-api-key": "SECRET_API_KEY",
        "Content-Type": "application/json",
      },
    })
  ).json();
  if (resRefresh.error) throw new Error(resRefresh.error);

  // 存在文件直接返回
  if (resRefresh.success) {
    onProgress(100);
    return resRefresh.expireTime;
  }

  // 正常上传文件
  const formData = new FormData();
  formData.append("hash", hash);
  formData.append("expire", expire);
  formData.append("file", blob, hash);

  const resUpload = await (
    await xhrFetch(`/api/upload`, {
      method: "post",
      headers: {
        "X-API-Key": "SECRET_API_KEY",
      },
      body: formData,
      onProgress({ percentage }) {
        onProgress(percentage);
      },
    })
  ).json();
  if (resUpload.error) throw new Error(resUpload.error);

  return resUpload.expireTime;
}

// 请求提取码
async function getFileCode({ name, size, hashs, expireTime }) {
  const res = await (
    await fetch(`/api/generate-code`, {
      method: "post",
      headers: {
        "X-API-Key": "SECRET_API_KEY",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, size, hashs, expireTime }),
    })
  ).json();
  return res.code;
}

// 查询提取码
async function retrieveCode(code) {
  const res = await (await fetch("/api/retrieve/" + code)).json();
  if (res.error) throw new Error(res.statusText);
  return res;
}

// 下载文件
async function downloadFile(hash, onProgress) {
  const res = await downloadWithProgress("/api/download/" + hash, onProgress);
  if (res.ok) return await res.arraybuffer();
  else throw new Error((await res.json()).error);
}

// 分片加密文件并上传
async function encryptAndUpload({
  file,
  expire,
  password,
  chunkSize = DEFAULT_CHUNCK_SIZE,
  onProgress,
}) {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const hashs = [];
  let chunkIndex = 0;
  let fileExpireTime;

  onProgress({ totalChunks, finishedChunks: chunkIndex });

  for (; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    // 加密分片
    const { encryptedBlob: blob, hash } = await encryptChunk(chunk, password);

    // 上传
    const expireTime = await uploadFile({
      blob,
      hash,
      expire,
      onProgress(percentage) {
        onProgress({
          totalChunks,
          finishedChunks: chunkIndex + percentage / 100,
        });
      },
    });

    hashs.push(hash);
    if (chunkIndex === 0) fileExpireTime = expireTime;
  }
  onProgress({ totalChunks, finishedChunks: totalChunks });

  return { hashs, fileExpireTime };
}

// 加密文件分片
async function encryptChunk(chunk, password) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const chunkWordArray = CryptoJS.lib.WordArray.create(e.target.result);

      // 计算文件哈希值
      const hash = CryptoJS.SHA256(
        CryptoJS.enc.Latin1.parse(password).concat(chunkWordArray)
      ).toString();

      // 使用AES-CBC模式加密
      const encrypted = CryptoJS.AES.encrypt(chunkWordArray, password);

      const encryptedBlob = new Blob(
        [
          wordArrayToArrayBuffer(encrypted.iv), // 16Bytes
          wordArrayToArrayBuffer(encrypted.salt), // 8Bytes
          wordArrayToArrayBuffer(encrypted.ciphertext),
        ],
        { type: "application/octet-stream" }
      );

      resolve({ encryptedBlob, hash });
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(chunk);
  });
}

// 流式保存文件
async function saveFile(fileInfo, password, onProgress) {
  if (fileInfo.size < BIG_FILE_SIZE) {
    // 小文件使用全部存入Blob方案
    let index = 0;
    const buffers = [];
    const totalChunks = fileInfo.hashs.length;
    for (; index < totalChunks; index++) {
      buffers.push(
        await downloadAndDecrypt(
          fileInfo.hashs[index],
          password,
          ({ percentage }) =>
            onProgress({
              totalChunks,
              finishedChunks: index + percentage / 100,
            })
        )
      );
    }
    const url = URL.createObjectURL(new Blob(buffers));
    clickDownload(url, fileInfo.name);
    onProgress({
      totalChunks,
      finishedChunks: totalChunks,
    });

    // 大文件使用File System Access API 方案
  } else if ("showSaveFilePicker" in window && detectChrome91Plus()) {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: fileInfo.name,
    });
    const writable = await fileHandle.createWritable();
    let index = 0;
    const totalChunks = fileInfo.hashs.length;
    for (; index < totalChunks; index++) {
      await writable.write(
        await downloadAndDecrypt(
          fileInfo.hashs[index],
          password,
          ({ percentage }) =>
            onProgress({
              totalChunks,
              finishedChunks: index + percentage / 100,
            })
        )
      );
    }
    await writable.close();
    onProgress({
      totalChunks,
      finishedChunks: totalChunks,
    });

    // Service Worker方案
  } else if ("serviceWorker" in navigator) {
    await registServiceWorker("./download.worker.js");
    // 通知ServiceWorker要下载的文件
    navigator.serviceWorker.controller.postMessage({
      type: "FILE",
      fileInfo,
      password,
    });
    // ServiceWorker准备就绪
    navigator.serviceWorker.addEventListener("message", () => clickDownload(), {
      once: true,
    });
    onProgress({ totalChunks: 0 });
  } else {
    throw new Error("不支持下载！");
  }
}

// 点击下载
function clickDownload(href, download) {
  const a = document.createElement("a");
  a.href = href || "/saveFile";
  if (download) a.download = download;
  // a.target = "_blank";
  a.click();
}

// 下载并解密文件分片
async function downloadAndDecrypt(hash, password, onProgress) {
  const fileBuffer = await downloadFile(hash, onProgress);
  if (!fileBuffer) return;

  const cipherParams = CryptoJS.lib.CipherParams.create({
    iv: CryptoJS.lib.WordArray.create(fileBuffer.slice(0, 16)),
    salt: CryptoJS.lib.WordArray.create(fileBuffer.slice(16, 24)),
    ciphertext: CryptoJS.lib.WordArray.create(fileBuffer.slice(24)),
  });

  return wordArrayToArrayBuffer(CryptoJS.AES.decrypt(cipherParams, password));
}

// CryptoJS的工具函数
function wordArrayToArrayBuffer(wordArray) {
  const words = wordArray.words;

  // 创建 ArrayBuffer
  const buffer = new ArrayBuffer(words.length * 4);
  const view = new DataView(buffer);

  // 遍历每个字并写入 ArrayBuffer
  for (let i = 0, offset = 0; i < words.length; i++, offset += 4) {
    const word = words[i];
    view.setUint32(offset, word, false); // false 表示大端序
  }

  // 修剪多余的字节
  return buffer.slice(0, wordArray.sigBytes);
}

// 使用AwesomeQR生成二维码
function generateAwesomeQR(text, imgDOM) {
  new AwesomeQR.AwesomeQR({
    text: text,
    size: 500,
    margin: 0,
    autoColor: true,
    colorDark: "#000000",
    colorLight: "#ffffff",
  })
    .draw()
    .then((dataURL) => (imgDOM.src = dataURL));
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 用xhr实现的fetch，支持获取上传进度
function xhrFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    // 创建XHR对象
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "GET", url);

    // 设置请求头
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    // 处理上传进度
    if (options.onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          options.onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      });
    }

    // 处理响应
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        json: () => Promise.resolve(JSON.parse(xhr.responseText)),
        text: () => Promise.resolve(xhr.responseText),
      });
    };

    // 处理错误
    xhr.onerror = () => {
      reject(new TypeError("Network request failed"));
    };

    // 处理超时
    xhr.ontimeout = () => {
      reject(new TypeError("Request timed out"));
    };

    // 发送请求
    xhr.send(options.body);
  });
}

// 监听下载进度的下载函数
async function downloadWithProgress(url, onProgress) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const contentLength = +response.headers.get("Content-Length");

  let received = 0;
  let chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    onProgress &&
      onProgress({
        loaded: received,
        total: contentLength,
        percentage: contentLength ? (received / contentLength) * 100 : 100,
      });
  }

  // 合并数据
  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return {
    ok: response.ok,
    arraybuffer: async () => data.buffer,
    json: async () => JSON.parse(new TextDecoder().decode(data)),
  };
}

// 注册ServiceWorker
async function registServiceWorker(workerJs) {
  if (!navigator.serviceWorker) return false;

  const registration = await navigator.serviceWorker.register(workerJs);

  // 如果已经有活跃的Service Worker
  if (registration.active && registration.active.state === "activated") {
    return true;
  }

  // 否则等待激活
  return new Promise((resolve) => {
    navigator.serviceWorker.addEventListener("controllerchange", resolve, {
      once: true,
    });
    registration.addEventListener("updatefound", () => {
      const sw = registration.installing;
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") {
          resolve();
        }
      });
    });
  });
}

// 格式化时间戳
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 月份从0开始需+1
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 检测浏览器版本
function detectChrome91Plus() {
  const ua = navigator.userAgent;
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  return chromeMatch && parseInt(chromeMatch[1], 10) >= 91;
}

// 转换文件类型为中文名
function parseMimeType(mimeType) {
  if (!mimeType) return;
  const normalizedType = mimeType.toLowerCase().trim();

  const mimeTypeMap = {
    // 文本类型
    "text/plain": "纯文本文件",
    "text/html": "HTML网页",
    "text/csv": "CSV数据文件",
    "text/markdown": "Markdown文档",

    // 应用类型
    "application/json": "JSON数据",
    "application/xml": "XML文件",
    "application/pdf": "PDF文档",
    "application/x-msdownload": "Windows可执行程序",
    "application/x-executable": "可执行文件",

    // 压缩文件类型
    "application/zip": "ZIP压缩文件",
    "application/gzip": "GZIP压缩文件",
    "application/x-compressed": "压缩文件",
    "application/x-zip-compressed": "ZIP压缩文件",
    "application/x-rar-compressed": "RAR压缩文件",
    "application/x-7z-compressed": "7-Zip压缩文件",
    "application/x-tar": "TAR归档文件",

    // 图像类型
    "image/jpeg": "JPEG图像",
    "image/png": "PNG图像",
    "image/gif": "GIF图像",
    "image/svg+xml": "SVG矢量图像",
    "image/webp": "WebP图像",
    "image/bmp": "位图图像",
    "image/tiff": "TIFF图像",

    // 音频类型
    "audio/mpeg": "MP3音频",
    "audio/wav": "WAV音频",
    "audio/aac": "AAC音频",

    // 视频类型
    "video/mp4": "MP4视频",
    "video/mpeg": "MPEG视频",
    "video/quicktime": "QuickTime视频",
    "video/x-msvideo": "AVI视频",

    // 办公文档
    "application/msword": "Word文档(旧版)",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Word文档",
    "application/vnd.ms-excel": "Excel文档(旧版)",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Excel文档",
    "application/vnd.ms-powerpoint": "PowerPoint文档(旧版)",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PowerPoint文档",
    "application/wps-office.wps": "WPS文字文档",
    "application/wps-office.et": "WPS表格",
    "application/wps-office.dps": "WPS演示",
    "application/vnd.ms-works": "WPS文档(兼容格式)",
  };

  return mimeTypeMap[normalizedType] || "其他类型";
}
