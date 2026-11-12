# Google 日历 → Leon 训练网页

这份版本在原有页面上增加只读日历功能。不会创建、修改或删除 Google 日历事件。原有打卡及重量存储键保持不变，在同一个浏览器、同一个网站地址使用时会继续读取原记录。上传前仍建议导出 JSON 备份。

## 1. 确认网页地址

你提供的仓库：https://github.com/0haowei/leon-training/

默认 Pages 地址应为 https://0haowei.github.io/leon-training/ 。请在仓库 Settings → Pages 查看实际地址；若使用自定义域名，下方来源也要改成实际域名。

## 2. 创建 Google 客户端（一次性）

1. 打开 https://console.cloud.google.com/ ，创建或选择一个项目。
2. 在 API 和服务 → 库中启用 Google Calendar API。
3. 在 Google Auth platform 配置应用名称、联系邮箱和受众。个人 Google 账号通常选择 External；开发测试阶段把自己的 Google 邮箱加入测试用户。
4. 在 Data Access 中添加以下只读权限：
   - `https://www.googleapis.com/auth/calendar.events.readonly`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
5. 在 Clients 中创建 OAuth 客户端，类型选 Web application。
6. Authorized JavaScript origins 填入 **`https://0haowei.github.io`**，不要加 `/leon-training/` 路径。若 Pages 实际使用自定义域名，则填该域名的 HTTPS 来源。
7. 本实现使用 Google 弹窗 token 流程，无需填写重定向 URI，也无需在网页中填写客户端密钥。
8. 复制以 `.apps.googleusercontent.com` 结尾的 Client ID。

官方说明：https://developers.google.com/workspace/calendar/api/quickstart/js

## 3. 上传新版并连接

1. 将此文件夹中的 `index.html`、`calendar.js`、`calendar.css`、`sw.js`、`manifest.webmanifest` 和 `icons/` 上传到原仓库根目录；保留原文件名。不要上传整个外层文件夹到仓库子目录。
2. 等待 GitHub Pages 部署完成，打开原网页。若仍显示旧版本，关闭所有该网站窗口后重新打开并刷新。
3. 展开「Google 日历 → 连接设置」，粘贴 Client ID，保存设置。
4. 点击「连接 Google 日历」，用加入测试用户的 Google 账号登录并同意两项读取权限。
5. 选择保存训练安排的日历。默认按训练关键词筛选；若建立了专用训练日历，可以清空关键词并保存，再刷新，显示其中所有事件。

Client ID 是应用公开标识，可以保存在浏览器；不要把 Client Secret 或令牌上传到 GitHub。当前代码只将令牌保存在页面内存，不将事件写入本地缓存。

## 使用方式与边界

- 在 Google 日历修改时间、改期或取消课程；授权有效时，本页每分钟刷新所选日期，返回页面、切换日期或点击「立即刷新」也会读取最新数据。
- 读取 Google 展开的重复事件，显示全天和跨天事件；时间统一按北京时间显示。
- 日历面板是实际安排；下面原有动作卡片是每周训练模板。连接后会隐藏模板中的固定时间，避免误认为它是当前日程。
- 本版不会自动把周二的动作卡片搬到周三，也不会移动历史打卡、按日历事件重建训练动作或自动调整饮食目标。具体训练内容仍按原每周模板显示。
- Google token 有效期有限。重新打开页面或令牌到期，需要再次点击连接。纯静态 Pages 不能保证无需交互的长期后台同步，页面关闭期间不读取日历。
- 无网络、无授权或读取失败时，不展示旧日程冒充最新结果；下方模板和本机记录仍可使用。
- 断开连接会清除当前页面中的令牌和事件，并恢复原每周计划显示。要完全撤销授权，可前往 Google 账号的第三方应用连接设置移除应用。
- 关键词只影响展示；Google 授权的只读范围允许读取你可访问的日历。选错日历或关键词过窄可能导致看不到课程。

## 自检

连接后，在所选日历里创建一个含「网球」的测试事件（手动操作），检查页面同一天能否显示。然后改时间、跨日移动、取消，每次回到对应日期刷新，确认变化。检查不会出现重复事件。此处需要你自己的真实 Google 授权才能完成端到端验证。

若提示 origin_mismatch，请核对浏览器地址的来源与 Google 配置是否一致；若提示 access_denied，请检查测试用户名单及授权；若无法加载 Google 组件，请检查该设备是否能访问 Google 服务。
