module.exports = {
  // httpPort: 88,                     // http服务端口
  httpsPort: 88,                    // https服务端口
  apiKey: "SECRET_API_KEY",         // 接口鉴权密钥
  uploadDir: "./uploads",           // 文件存储目录
  dataDir: "./data",                // 数据文件目录
  defaultExpire: 24 * 60 * 60,      // 默认过期时间（秒）
  codeLength: 6,                    // 提取码长度
  codeChars: "0123456789",          // 提取码字符集
  requestMaxSize: 10 * 1024 * 1024, // 10MB
};
