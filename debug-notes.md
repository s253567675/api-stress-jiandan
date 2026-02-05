# 调试笔记 - 成功判断逻辑

## 当前配置状态

从截图可以看到，高级配置中的"自定义成功条件"已经正确配置：
- 开关：已开启（绿色）
- 字段路径：code
- 匹配条件：等于
- 期望值：0

## 代码逻辑分析

1. `checkSuccessCondition` 函数（useStressTest.ts 第285-335行）：
   - 当 `condition.enabled` 为 true 时，会解析响应体JSON
   - 提取指定字段（如 `code`）的值
   - 根据匹配条件判断成功与否
   - 返回 `{ success, businessCode }`

2. `makeProxyRequest` 函数（第338-390行）：
   - 调用 `checkSuccessCondition` 获取成功状态和业务状态码
   - 将结果存入 `RequestResult` 对象

## 可能的问题

问题可能在于：当API返回的响应体中没有 `code` 字段时，或者返回的格式不是预期的JSON格式，
`checkSuccessCondition` 可能会回退到使用HTTP状态码判断。

需要检查：
1. 测试的API实际返回的响应体格式
2. 是否正确解析了JSON并提取了code字段
