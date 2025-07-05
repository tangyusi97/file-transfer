document.addEventListener("DOMContentLoaded", function () {
  const DOM = {
    // 上传区域相关元素
    uploadArea: document.getElementById("upload-area"),
    fileInput: document.getElementById("file-input"),
    filePreview: document.getElementById("file-preview"),
    fileSettings: document.getElementById("file-settings"),
    previewName: document.getElementById("preview-name"),
    previewSize: document.getElementById("preview-size"),
    previewType: document.getElementById("preview-type"),
    filePassword: document.getElementById("file-password"),
    expiryTime: document.getElementById("expiry-time"),
    uploadBtns: document.getElementById("upload-btns"),
    confirmUpload: document.getElementById("confirm-upload"),
    cancelUpload: document.getElementById("cancel-upload"),
    uploadProgressContainer: document.getElementById(
      "upload-progress-container"
    ),
    uploadProgressBar: document.getElementById("upload-progress-bar"),
    uploadText: document.getElementById("upload-text"),
    uploadResult: document.getElementById("upload-result"),
    accessCode: document.getElementById("access-code"),
    pageUrl: document.getElementById("page-url"),
    qrcodeImage: document.getElementById("qr-image"),
    backToUpload: document.getElementById("back-to-upload"),

    // 下载区域相关元素
    downloadCode: document.getElementById("download-code"),
    retrieveBtns: document.getElementById("retrieve-btns"),
    retrieveBtn: document.getElementById("retrieve-btn"),
    fileInfo: document.getElementById("file-info"),
    fileName: document.getElementById("file-name"),
    fileSize: document.getElementById("file-size"),
    fileTime: document.getElementById("file-time"),
    downloadPasswordGroup: document.getElementById("download-password-group"),
    downloadPassword: document.getElementById("download-password"),
    downloadProgressContainer: document.getElementById(
      "download-progress-container"
    ),
    downloadProgressBar: document.getElementById("download-progress-bar"),
    downloadText: document.getElementById("download-text"),
    downloadBtns: document.getElementById("download-btns"),
    downloadBtn: document.getElementById("download-btn"),
    backToSearch: document.getElementById("back-to-search"),
    codeInputGroup: document.getElementById("code-input-group"),
    backToDownload: document.getElementById("back-to-download"),

    // 标签页相关元素
    tabs: document.querySelectorAll(".tab"),
    tabContents: document.querySelectorAll(".tab-content"),

    // 自定义弹窗相关元素
    customAlert: document.getElementById("custom-alert"),
    alertIcon: document.getElementById("alert-icon"),
    alertTitle: document.getElementById("alert-title"),
    alertMessage: document.getElementById("alert-message"),
    alertConfirm: document.getElementById("alert-confirm"),
  };

  let selectedFile = null;
  let retrievedFileInfo = null;

  // 上传状态枚举
  const UploadState = {
    INITIAL: 0,
    FILE_SELECTED: 1,
    UPLOADING: 2,
    UPLOADED: 3,
  };

  // 下载状态枚举
  const DownloadState = {
    INITIAL: 0,
    FILE_INFO: 1,
    DOWNLOADING: 2,
    DOWNLOADED: 3,
  };

  // 标签页切换功能
  DOM.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      DOM.tabs.forEach((t) => t.classList.remove("active"));
      DOM.tabContents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const tabId = tab.getAttribute("data-tab");
      document.getElementById(`${tabId}-tab`).classList.add("active");

      // 重置状态
      if (tabId === "upload") {
        setUploadState(UploadState.INITIAL);
      } else {
        setDownloadState(DownloadState.INITIAL);
      }
    });
  });

  // 设置上传状态函数
  function setUploadState(state) {
    // 隐藏所有上传相关元素
    DOM.uploadArea.style.display = "none";
    DOM.filePreview.style.display = "none";
    DOM.fileSettings.style.display = "none";
    DOM.uploadBtns.style.display = "none";
    DOM.uploadProgressContainer.style.display = "none";
    DOM.uploadResult.style.display = "none";
    DOM.backToUpload.style.display = "none";

    // 根据状态显示相应元素
    switch (state) {
      case UploadState.INITIAL:
        DOM.uploadArea.style.display = "";
        DOM.fileInput.value = "";
        DOM.filePassword.value = "";
        break;
      case UploadState.FILE_SELECTED:
        DOM.filePreview.style.display = "";
        DOM.fileSettings.style.display = "";
        DOM.uploadBtns.style.display = "";
        break;
      case UploadState.UPLOADING:
        DOM.filePreview.style.display = "";
        DOM.uploadProgressContainer.style.display = "";
        break;
      case UploadState.UPLOADED:
        DOM.filePreview.style.display = "";
        DOM.uploadResult.style.display = "";
        DOM.backToUpload.style.display = "";
        break;
    }
  }

  // 设置下载状态函数
  function setDownloadState(state) {
    // 隐藏所有下载相关元素
    DOM.codeInputGroup.style.display = "none";
    DOM.retrieveBtns.style.display = "none";
    DOM.fileInfo.style.display = "none";
    DOM.downloadBtns.style.display = "none";
    DOM.downloadPasswordGroup.style.display = "none";
    DOM.downloadProgressContainer.style.display = "none";
    DOM.backToDownload.style.display = "none";

    // 根据状态显示相应元素
    switch (state) {
      case DownloadState.INITIAL:
        DOM.codeInputGroup.style.display = "";
        DOM.retrieveBtns.style.display = "";
        DOM.downloadCode.value = "";
        DOM.downloadPassword.value = "";
        break;
      case DownloadState.FILE_INFO:
        DOM.fileInfo.style.display = "";
        DOM.downloadPasswordGroup.style.display = "";
        DOM.downloadBtns.style.display = "";
        break;
      case DownloadState.DOWNLOADING:
        DOM.fileInfo.style.display = "";
        DOM.downloadProgressContainer.style.display = "";
        break;
      case DownloadState.DOWNLOADED:
        DOM.fileInfo.style.display = "";
        DOM.downloadProgressContainer.style.display = "";
        DOM.backToDownload.style.display = "";
        break;
    }
  }

  // 自定义弹窗函数
  function showAlert(title, message, type = "info") {
    DOM.alertTitle.textContent = title;
    DOM.alertMessage.textContent = message;
    DOM.alertIcon.textContent =
      type === "error" ? "✖" : type === "success" ? "✓" : "ℹ";
    document.getElementById(
      "alert-content"
    ).className = `alert-content alert-${type}`;
    DOM.customAlert.classList.add("active");

    return new Promise((resolve) => {
      const confirmHandler = function () {
        DOM.customAlert.classList.remove("active");
        resolve(true);
        DOM.alertConfirm.removeEventListener("click", confirmHandler);
      };

      DOM.alertConfirm.addEventListener("click", confirmHandler);
      DOM.customAlert.addEventListener("click", function (e) {
        if (e.target === DOM.customAlert) {
          DOM.customAlert.classList.remove("active");
          resolve(false);
        }
      });
    });
  }

  // 选择文件上传
  const clickFileInput = () => DOM.fileInput.click();
  DOM.uploadArea.addEventListener("click", clickFileInput, { once: true });
  // 避免对话框弹出响应慢导致重复点击
  window.addEventListener("focus", () => {
    DOM.uploadArea.addEventListener("click", clickFileInput, { once: true });
  });

  DOM.fileInput.addEventListener("change", () => {
    if (!DOM.fileInput.files.length) return;

    selectedFile = DOM.fileInput.files[0];
    DOM.previewName.textContent = selectedFile.name;
    DOM.previewSize.textContent = formatFileSize(selectedFile.size);
    DOM.previewType.textContent =
      parseMimeType(selectedFile.type) || "未知类型";

    setUploadState(UploadState.FILE_SELECTED);
  });

  DOM.uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    DOM.uploadArea.classList.add("dragover");
  });

  DOM.uploadArea.addEventListener("dragleave", () => {
    DOM.uploadArea.classList.remove("dragover");
  });

  DOM.uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    DOM.uploadArea.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      DOM.fileInput.files = e.dataTransfer.files;
      selectedFile = e.dataTransfer.files[0];

      DOM.previewName.textContent = selectedFile.name;
      DOM.previewSize.textContent = formatFileSize(selectedFile.size);
      DOM.previewType.textContent = selectedFile.type || "未知类型";

      setUploadState(UploadState.FILE_SELECTED);
    }
  });

  // 取消上传
  DOM.cancelUpload.addEventListener("click", function () {
    setUploadState(UploadState.INITIAL);
    selectedFile = null;
  });

  // 上传文件
  DOM.confirmUpload.addEventListener("click", async function () {
    const password = DOM.filePassword.value.trim();
    if (!password) {
      await showAlert("请设置文件加密密码", "", "error");
      return;
    }

    // 上传中
    DOM.uploadProgressBar.style.width = 0;
    DOM.uploadText.textContent = "正在加密并上传文件...";
    setUploadState(UploadState.UPLOADING);

    try {
      const { hashs, fileExpireTime } = await encryptAndUpload({
        file: selectedFile,
        expire: DOM.expiryTime.value,
        password: DOM.filePassword.value,
        onProgress: ({ totalChunks, finishedChunks }) => {
          // 上传进度显示
          const progress = (finishedChunks / totalChunks) * 100;
          DOM.uploadProgressBar.style.width = `${progress}%`;
          DOM.uploadText.textContent =
            "正在加密并上传文件" + `（${progress.toFixed(1)}%）...`;
        },
      });
      DOM.uploadProgressBar.style.width = `100%`;
      DOM.uploadText.textContent = "上传成功！";

      //请求提取码
      const code = await getFileCode({
        name: selectedFile.name,
        size: selectedFile.size,
        hashs,
        expireTime: fileExpireTime,
      });

      DOM.accessCode.textContent = code;

      // 生成二维码
      generateAwesomeQR(
        `下载地址：${window.location.href}，提取码：${code}，解密密码：` +
          `${password}，过期时间：${new Date(fileExpireTime).toLocaleString()}`,
        DOM.qrcodeImage
      );

      // 显示结果
      setUploadState(UploadState.UPLOADED);
    } catch (error) {
      await showAlert("上传失败！", "", "error");
      console.error(error);
      setUploadState(UploadState.FILE_SELECTED);
    }
  });

  // 返回上传
  DOM.backToUpload.addEventListener("click", () => {
    setUploadState(UploadState.INITIAL);
    selectedFile = null;
  });

  // 提取码输入
  DOM.downloadCode.addEventListener("input", (e) => {
    DOM.downloadCode.value = e.target.value.toUpperCase();
  });

  // 通过提取码检索文件
  DOM.retrieveBtn.addEventListener("click", async function () {
    const code = DOM.downloadCode.value.trim();

    if (!code) {
      await showAlert("请输入提取码", "", "error");
      return;
    }

    DOM.retrieveBtn.disabled = true;
    DOM.retrieveBtn.textContent = "正在查询...";

    try {
      retrievedFileInfo = await retrieveCode(code);
    } catch (error) {
      await showAlert("查询失败！", "", "error");
      console.error(error);
      return;
    } finally {
      DOM.retrieveBtn.disabled = false;
      DOM.retrieveBtn.textContent = "提取文件";
    }
    // 显示文件信息
    DOM.fileName.textContent = retrievedFileInfo.name;
    DOM.fileSize.textContent = formatFileSize(retrievedFileInfo.size);
    DOM.fileTime.textContent = formatDate(retrievedFileInfo.expireTime);
    setDownloadState(DownloadState.FILE_INFO);
  });

  // 返回提取码输入
  DOM.backToSearch.addEventListener("click", function () {
    setDownloadState(DownloadState.INITIAL);
  });

  // 下载文件
  DOM.downloadBtn.addEventListener("click", async function () {
    const password = DOM.downloadPassword.value.trim();

    if (!password) {
      await showAlert("请输入解密密码", "", "error");
      return;
    }

    DOM.downloadText.textContent = "正在解密并下载文件...";
    DOM.downloadProgressBar.style.width = 0;

    // 下载中
    setDownloadState(DownloadState.DOWNLOADING);

    try {
      await saveFile(
        retrievedFileInfo,
        password,
        ({ totalChunks, finishedChunks }) => {
          if (totalChunks) {
            const progress = (finishedChunks / totalChunks) * 100;
            DOM.downloadProgressBar.style.width = `${progress}%`;
            DOM.downloadText.textContent =
              "正在下载并解密文件" + `（${progress.toFixed(1)}%）...`;
          }
        }
      );
    } catch (error) {
      await showAlert("下载失败！", "", "error");
      console.error(error);
      setDownloadState(DownloadState.FILE_INFO);
      return;
    }

    // 下载完成
    DOM.downloadProgressBar.style.width = `100%`;
    DOM.downloadText.textContent = "文件下载并解密完成！";
    setDownloadState(DownloadState.DOWNLOADED);
  });

  // 返回下载
  DOM.backToDownload.addEventListener("click", function () {
    setDownloadState(DownloadState.INITIAL);
  });

  // 初始化页面URL
  DOM.pageUrl.textContent = window.location.href;

  // 初始状态设置
  setUploadState(UploadState.INITIAL);
  setDownloadState(DownloadState.INITIAL);
});
