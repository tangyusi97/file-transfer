# 参数设置
$ip = Read-Host "请输入IP地址"
$code = Read-Host "请输入证书密码"

# 生成自签名证书
$cert = New-SelfSignedCertificate `
    -Subject "FileTransfer" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -NotAfter (Get-Date).AddYears(10) `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -FriendlyName "FileTransfer Service Certificate" `
    -KeyUsage DigitalSignature, KeyEncipherment, DataEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1", "2.5.29.17={text}IPAddress=$ip&DNS=localhost")
    
# 导出证书（不含私钥）
Export-Certificate -Cert $cert -FilePath ".\certification.cer" -Type CERT

# 导出PFX文件
$pwd = ConvertTo-SecureString -String $code -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath ".\certification.pfx" -Password $pwd
