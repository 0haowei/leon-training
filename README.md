# Leon Training PWA

## GitHub Pages 部署
1. 在 GitHub 新建公开仓库 `leon-training`。
2. 将 ZIP 解压后 **leon-training 文件夹里面的所有文件** 上传到仓库根目录（确保根目录有 `index.html`、`sw.js`、`manifest.webmanifest` 和 `icons/`）。
3. Settings → Pages → Deploy from a branch → main → /(root) → Save。
4. 等待 Pages 发布后，在 iPhone Safari 打开 `https://用户名.github.io/leon-training/`，分享 → 添加到主屏幕。

## 数据
- 训练勾选和重量按北京时间日期存储在本设备 localStorage。
- 使用顶部「导出 JSON」定期备份；更换手机或清除网站数据前务必导出。
- 「导入 JSON」会合并备份，同名记录覆盖当前记录。
- 不提供云端同步；不同设备、Safari 与桌面网页可能使用不同存储空间。
- 训练动作示意为简图，外部专业教学链接需联网访问。
- 网页使用北京时间判断今天；每日营养值为初始估算。

## 更新
替换仓库文件后，重新打开网页并联网加载一次以更新缓存。

## Google 日历只读版本
新增 calendar.js 与 calendar.css；请先阅读 Google日历配置.md。训练记录仍只保存在本机，Google 日历仅用于读取实际安排。连接有效期间自动刷新，重开页面需重新连接。

