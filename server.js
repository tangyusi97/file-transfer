const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const express = require("express");
const multer = require("multer");
const config = require("./config");

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const uploadDir = path.join(__dirname, config.uploadDir);
const dataDir = path.join(__dirname, config.dataDir);

// 确保目录存在
[uploadDir, dataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 数据文件路径
const FILES_DB = path.join(dataDir, "files.json");
const CODES_DB = path.join(dataDir, "codes.json");

// 初始化数据存储
const initDb = (filePath, defaultValue = {}) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue));
  }
  return JSON.parse(fs.readFileSync(filePath));
};
const filesDb = initDb(FILES_DB);
const codesDb = initDb(CODES_DB);

// 数据保存（3秒节流）
const saveDbFn = (dbPath, dbObj) => {
  let lastExc = 0;
  let timer = null;
  return () => {
    const delay = Date.now() - lastExc;
    if (lastExc === 0 || delay > 3000) {
      clearTimeout(timer);
      timer = null;
      fs.writeFileSync(dbPath, JSON.stringify(dbObj));
      lastExc = Date.now();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        fs.writeFileSync(dbPath, JSON.stringify(dbObj));
        lastExc = Date.now();
      }, 3000 - delay);
    }
  };
};
const saveFilesDb = saveDbFn(FILES_DB, filesDb);
const saveCodesDb = saveDbFn(CODES_DB, codesDb);

// 限制请求体大小
app.use((req, res, next) => {
  // 检查头content-length
  if (req.headers["content-length"] > config.requestMaxSize) {
    res.status(413).send("Payload too large");
    return req.destroy();
  }

  // 检测到实际响应体超过限制
  let bodySize = 0;
  req.on("data", (chunk) => {
    bodySize += chunk.length;
    if (bodySize > config.requestMaxSize) {
      res.status(413).send("Payload too large");
      req.destroy();
    }
  });

  next();
});

// API密钥鉴权中间件
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey === config.apiKey) return next();
  res.status(401).json({ error: "Unauthorized" });
};

// 文件存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// 生成唯一提取码
const generateUniqueCode = (existingCodes) => {
  let code;
  do {
    code = Array.from({ length: config.codeLength }, () =>
      config.codeChars.charAt(
        Math.floor(Math.random() * config.codeChars.length)
      )
    ).join("");
  } while (existingCodes[code]);
  return code;
};

// 文件上传接口
app.post("/api/upload", apiKeyAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const hash = req.body.hash;
  if (!hash) return res.status(400).json({ error: "Missing file hash" });

  const path = req.file.path;
  const expireTime =
    Date.now() + (req.body.expire || config.defaultExpire) * 1000;
  const ip = req.ip;

  filesDb[hash] = { path, expireTime, ip };
  saveFilesDb();

  res.json({ success: true, hash, expireTime });
});

// 文件刷新接口
app.post("/api/refresh", apiKeyAuth, (req, res) => {
  const { hash, expire } = req.body;
  if (!hash) return res.status(400).json({ error: "Missing file hash" });

  if (filesDb[hash]) {
    const expireTime = Date.now() + (expire || config.defaultExpire) * 1000;
    filesDb[hash].expireTime = expireTime;
    filesDb[hash].ip = req.ip;
    saveFilesDb();
    res.json({
      success: true,
      hash,
      expireTime,
    });
  } else {
    res.json({
      success: false,
    });
  }
});

// 生成提取码接口
app.post("/api/generate-code", apiKeyAuth, (req, res) => {
  const {
    name,
    size,
    hashs,
    pwdHash,
    expireTime = Date.now() + config.defaultExpire * 1000,
  } = req.body;
  if (!Array.isArray(hashs) || hashs.length === 0) {
    return res.status(400).json({ error: "Invalid hash list" });
  }

  // // 验证所有哈希值是否存在
  // for (const hash of hashs) {
  //   if (!filesDb[hash]) {
  //     return res.status(404).json({ error: `File not found: ${hash}` });
  //   }
  // }

  // 生成唯一提取码
  const code = generateUniqueCode(codesDb);
  codesDb[code] = { name, size, hashs, pwdHash, expireTime, ip: req.ip };
  saveCodesDb();

  res.json({ code, expireTime });
});

// 文件下载接口
app.get("/api/download/:hash", (req, res) => {
  const { hash } = req.params;

  const fileData = filesDb[hash];
  if (!fileData) return res.status(404).json({ error: "File not found" });

  // 发送文件
  res.download(fileData.path, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: "Download failed" });
    }
  });
});

// 通过提取码获取文件列表
app.get("/api/retrieve/:code", (req, res) => {
  const { code } = req.params;

  const codeData = codesDb[code];
  if (!codeData)
    return res.status(404).json({ error: "Invalid download code" });

  res.json(codeData);
});

// 清理过期文件
const cleanExpired = () => {
  const now = Date.now();

  // 清理过期提取码
  Object.keys(codesDb).forEach((code) => {
    if (codesDb[code].expireTime < now) delete codesDb[code];
  });

  // 清理过期文件
  Object.keys(filesDb).forEach((hash) => {
    if (filesDb[hash].expireTime < now) {
      fs.unlink(filesDb[hash].path, () => {});
      delete filesDb[hash];
    }
  });

  saveFilesDb();
  saveCodesDb();
};
cleanExpired();

// 每小时清理一次
setInterval(cleanExpired, 60 * 60 * 1000);

const httpPort = config.httpPort || 80;
const httpsPort = config.httpsPort || 443;

// 启动http服务
http.createServer(app).listen(httpPort, () => {
  console.log(`HTTP server running on port ${httpPort}`);
});

// 启动https服务
const certPath = path.join(__dirname, config.certFile);
const keyPath = path.join(__dirname, config.keyFile);
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  https
    .createServer(
      { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
      app
    )
    .listen(httpsPort, () => {
      console.log(`HTTPS server running on port ${httpsPort}`);
    });
}

// // 80端口重定向到https
// http
//   .createServer((req, res) => {
//     res.writeHead(301, {
//       Location: `http://${req.headers.host}${req.url}`,
//     });
//     res.end();
//   })
//   .listen(80, () => {
//     console.log("HTTP server running on port 80 (redirecting to HTTP)");
//   });
