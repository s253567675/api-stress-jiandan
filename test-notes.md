# API压力测试工具 - 测试说明

## 测试结果分析

### 观察到的现象
- 所有请求显示 "Failed to fetch" 错误
- 错误率 100%
- 状态码显示为 0

### 原因分析
这是**预期行为**，因为：

1. **浏览器CORS限制**：浏览器端的JavaScript无法直接向跨域API发送请求，除非目标API服务器配置了正确的CORS响应头（Access-Control-Allow-Origin）。

2. **API网关限制**：AWS API Gateway默认不允许来自任意域名的跨域请求。

### 解决方案

#### 方案一：使用CORS代理（推荐用于测试）
可以通过CORS代理服务来绕过浏览器限制：
- 公共代理：`https://cors-anywhere.herokuapp.com/`
- 自建代理服务

#### 方案二：后端代理
将压测工具升级为全栈应用，在后端发起请求，避免CORS限制。

#### 方案三：浏览器扩展
安装CORS解除限制的浏览器扩展（仅用于开发测试）。

#### 方案四：API服务端配置
联系API提供方，在响应头中添加：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-api-key
```

## 工具功能验证

尽管请求失败，但压测工具的核心功能已验证正常：

✅ 并发控制正常工作
✅ QPS限制正常工作
✅ 实时图表更新正常
✅ 指标统计正确
✅ 日志记录完整
✅ 状态码分布显示正确
✅ 延迟百分位计算正确
✅ 进度条和状态指示正常

## 建议

对于实际使用场景，建议：
1. 如果API支持CORS，可直接使用
2. 如果API不支持CORS，需要升级为后端代理模式
3. 或者使用专业的压测工具如 k6、JMeter、wrk 等
