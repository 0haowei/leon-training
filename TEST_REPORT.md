# V6.4 测试报告

通过：node tests/core.test.cjs；node tests/compact.cjs。

浏览器使用隔离 Chrome、375×812触控视口和模拟 Google API，不访问真实日历。

- 六个力量动作、五个结构化网球阶段、三营养数字及四餐摘要。
- 常规动作行实测60–85px；无横向溢出；提示不超过30字。
- 点击名称展开图片/教学，默认折叠；默认无重量/次数/备注输入。
- 独立勾选更新完成数和进度；刷新后保留。
- 模拟日历3组改4组，新训练量显示且旧打卡不变。
- 已有42.5kg记录保留，高级模式可查看，关闭后无输入框。
- 普通饮食/网球备注不生成卡片，保留原文。
- Service Worker离线重载成功，完成状态与缓存保留。
- 没有页面JS异常。核心协议、身份、迁移、导入回滚等测试继续通过。

截图：compact-strength.png、compact-tennis.png、compact-food.png，位于 tests/。已检查紧凑布局。

限制：尚未在实体 iPhone Safari / 主屏幕 PWA 验证；Chrome手机视口测试不等于iOS实测。未在真实 Google Calendar 修改计划，在线同步流程使用模拟响应。部署后请在实际手机检查输入、连接和离线重开。授权过期或冷启动需重新连接。

旧 tests/e2e.cjs 是V6.3详细输入界面的历史测试，不作为V6.4验收脚本；运行compact.cjs。需要Node、Playwright和Chrome，路径见脚本。源码备份是原Leon_Training_V6.3_Final目录，用户记录需网页导出。
