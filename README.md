# API 压力测试工具 - 部署文件说明

本压缩包包含腾讯云一键部署所需的所有文件。请按照以下说明将文件放置到正确位置。

## 文件清单

| 文件名 | 放置位置 | 说明 |
| :--- | :--- | :--- |
| `deploy-all-in-one.sh` | 项目根目录 | 一键部署脚本（核心） |
| `TENCENT_CLOUD_DEPLOYMENT.md` | 项目根目录 | 部署方案技术文档 |
| `腾讯云一键部署指南.md` | 项目根目录 | 傻瓜式操作指南 |
| `create-admin.ts` | `scripts/` 目录 | 创建管理员账号脚本 |
| `const.ts` | `client/src/` 目录 | 修复 OAuth 配置问题（替换原文件） |

## 目录结构

将文件放置后，项目目录结构应如下所示：

```
api-stress-tester/
├── deploy-all-in-one.sh          ← 新增（放在根目录）
├── TENCENT_CLOUD_DEPLOYMENT.md   ← 新增（放在根目录）
├── 腾讯云一键部署指南.md          ← 新增（放在根目录）
├── scripts/
│   └── create-admin.ts           ← 新增（放在 scripts 目录）
├── client/
│   └── src/
│       └── const.ts              ← 替换（覆盖原文件）
├── package.json
├── ... (其他原有文件)
```

## 操作步骤

### 1. 克隆仓库（如果还没有）

```bash
git clone https://github.com/s253567675/api-stress-tester.git
cd api-stress-tester
```

### 2. 放置文件

将压缩包中的文件按上表放置到对应位置：

```bash
# 假设您已解压到 ~/Downloads/api-stress-tester-deploy-files/

# 复制根目录文件
cp ~/Downloads/api-stress-tester-deploy-files/deploy-all-in-one.sh ./
cp ~/Downloads/api-stress-tester-deploy-files/TENCENT_CLOUD_DEPLOYMENT.md ./
cp ~/Downloads/api-stress-tester-deploy-files/腾讯云一键部署指南.md ./

# 创建 scripts 目录（如果不存在）
mkdir -p scripts

# 复制脚本文件
cp ~/Downloads/api-stress-tester-deploy-files/create-admin.ts ./scripts/

# 替换 const.ts
cp ~/Downloads/api-stress-tester-deploy-files/const.ts ./client/src/
```

### 3. 提交到 Git

```bash
git add -A
git commit -m "feat: 添加腾讯云一键部署脚本和文档

- 新增 deploy-all-in-one.sh 一键部署脚本
- 新增 TENCENT_CLOUD_DEPLOYMENT.md 部署方案文档
- 新增 腾讯云一键部署指南.md 操作指南
- 新增 scripts/create-admin.ts 管理员创建脚本
- 修复 client/src/const.ts OAuth 未配置时的错误"

git push origin main
```

## 文件说明

### deploy-all-in-one.sh

这是核心的一键部署脚本，功能包括：
- 自动安装 Docker 和 Docker Compose
- 生成所有配置文件
- 构建 Docker 镜像
- 启动 MySQL、后端、Nginx 服务
- 初始化数据库并创建管理员账号

### const.ts

修复了原代码中的一个问题：当 OAuth 环境变量未配置时，会导致前端报错。修改后支持本地用户名密码登录。

### create-admin.ts

用于在数据库中创建默认管理员账号的脚本。

## 部署使用

文件同步到 GitHub 后，在腾讯云服务器上执行：

```bash
apt-get update && apt-get install -y git && \
git clone https://github.com/s253567675/api-stress-tester.git && \
cd api-stress-tester && \
chmod +x deploy-all-in-one.sh && \
sudo ./deploy-all-in-one.sh
```

等待 5-10 分钟即可完成部署！

---

如有问题，请参考 `腾讯云一键部署指南.md` 文档。
