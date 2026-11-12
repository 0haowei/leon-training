# 日历备注协议 leon-training/v1

日期、时间、标题、重复规则由 Google Calendar 事件字段负责。description 中保留人类摘要，并放一对标记。标记内部只能是合法 JSON：双引号、无注释、无尾逗号、无 Markdown 代码围栏。PWA 只解析这一数据块。

## 两张力量卡片

将以下整段写进事件备注：

```text
下肢训练：深蹲3组×8次，罗马尼亚硬拉3组×8次。
[LEON_DATA_START]
{
  "schema": "leon-training/v1",
  "type": "strength",
  "exercises": [
    {"id": "barbell-squat", "sets": 3, "reps": "8"},
    {"id": "romanian-deadlift", "sets": 3, "reps": "8"}
  ],
  "notes": "根据当天状态完成。"
}
[LEON_DATA_END]
```

以后将 sets 从3改成4，成功同步后显示4组，原3组记录保留。仅修改人类摘要不改变卡片，须同步修改 JSON。没有标记或解析失败时保留原始备注，不推测动作。

## 字段

| 字段 | 含义 |
|---|---|
| schema | 固定 leon-training/v1 |
| type | strength / tennis / recovery / nutrition |
| exercises | 前三类的动作数组，最多100项 |
| id | 稳定ID，1—80位字母、数字、点、下划线或短横线；首位字母或数字 |
| name | 未知动作的名称；已知动作使用资料库名称 |
| slotId | 默认同 id；相同动作重复出现时，各项需唯一且稳定 |
| sets | 0—30整数，或含稳定 setId 的数组；缺省不推测 |
| reps | 次数文本，例如 6–8、10/侧 |
| durationMinutes | 时长数字，0—1440分钟 |
| recordType | 可选 strength / duration / serve；未知发球动作显式填 serve |
| notes | 顶层或单动作注意事项，文本，不是独立动作 |

strength 显示逐组重量、次数、完成；只有时长且无组数的动作显示时长。tennis/recovery 不显示重量；serve 增加发球数、进球数、进球率。

整数 sets 对应 set-1、set-2 等。精确管理不同组时使用：

```json
{"id":"barbell-squat","sets":[
  {"setId":"warmup","reps":"8"},
  {"setId":"work-1","reps":"6–8"},
  {"setId":"work-2","reps":"6–8"}
]}
```

保持 setId 不变。将 set-1 改名为 work-1 不会自动匹配，但旧记录仍在历史中。同一动作出现两次可设 slotId 为 morning/evening，之后不要随意改名。

## 六张下肢卡片

以下是用户已有计划的结构表达示例，不是应用内固定周计划。把 JSON 放入标记之间：

```json
{
 "schema":"leon-training/v1","type":"strength",
 "exercises":[
  {"id":"dynamic-warmup","durationMinutes":8,"recordType":"duration"},
  {"id":"barbell-squat","sets":3,"reps":"6–8"},
  {"id":"romanian-deadlift","sets":3,"reps":"8"},
  {"id":"leg-curl","sets":2,"reps":"10–12"},
  {"id":"standing-calf-raise","sets":3,"reps":"12–15"},
  {"id":"pallof-press","sets":2,"reps":"10/侧"}
 ],
 "notes":"初期保留2–3次余力。疼痛时停止诱发动作。"
}
```

## 五张发球卡片

```json
{
 "schema":"leon-training/v1","type":"tennis",
 "exercises":[
  {"id":"serve-warmup","durationMinutes":10},
  {"id":"serve-toss","durationMinutes":15},
  {"id":"second-serve","durationMinutes":15,"recordType":"serve"},
  {"id":"first-serve","durationMinutes":15,"recordType":"serve"},
  {"id":"video-review","durationMinutes":5}
 ],
 "notes":"避免连续全力发球；肩臂疼痛时停止诱发动作。"
}
```

## 饮食

```json
{
 "schema":"leon-training/v1","type":"nutrition",
 "macros":{"protein":125,"carbs":350,"fat":75},
 "meals":[
  {"name":"早餐","description":"香蕉1根、面包60–80g"},
  {"name":"午餐","description":"熟米饭250–300g、熟鸡胸肉120–150g、蔬菜200g"},
  {"name":"晚餐","description":"按协商后的计划填写"},
  {"name":"加餐","description":"酸奶200g、燕麦50g、水果1份"}
 ],
 "notes":"目标为全天总量，包含饮料和加餐。"
}
```

macros 单位克，数值非负；meals 最多30项，每项 name/description 为文本。删除餐次或清空其 description，下次同步后该餐不再显示。

## 新动作无需部署

向 exercises 加入：

```json
{"id":"new-drill-2027","name":"新阶段截击练习","durationMinutes":12,"recordType":"duration","notes":"按教练要求完成"}
```

立即生成基础卡片；教学资源缺失明确提示。JSON 不接受任意教学脚本/图片链接；教学资料须经核实后加入资料库。

现有资料 ID：dynamic-warmup、barbell-squat、romanian-deadlift、leg-curl、standing-calf-raise、pallof-press、serve-warmup、serve-toss、second-serve、first-serve、video-review、split-step、recover、forehand、bounce-reading。

重复规则由 Google 管理。PWA 使用 singleEvents=true 展开实例，并关联 recurringEventId 与 originalStartTime，不另存星期模板。仅更改系列规则可能让 Google 生成不同实例身份；不保证自动关联到此前实例，原记录仍可在历史中找到。


## V6.4 显示说明

协议不变，训练参数仍严格来自JSON。默认只显示动作完成勾选，逐组字段在高级模式中开启。网球阶段依JSON顺序排列，开始时刻由事件start.dateTime与前面已提供的durationMinutes累加；缺少时长则不推测后续时刻。饮食摘要仅截短展示，详细建议保留完整内容。自由文本不生成计划卡片。
