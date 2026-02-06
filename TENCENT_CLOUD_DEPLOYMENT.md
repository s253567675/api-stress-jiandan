# API 压力测试工具 - 腾讯云一键部署方案

**版本**: 1.0
**作者**: Manus AI

## 1. 方案概述

为了实现在腾讯云上进行“傻瓜式”的一键部署，我们采用 **Docker Compose** 作为核心技术。该方案将整个应用（包括数据库、后端服务和前端界面）容器化，通过一个简单的部署脚本和 `docker-compose.yml` 文件，实现环境的自动配置和服务的快速启动。这种方法不仅简化了部署流程，还提供了极佳的环境隔离性、可移植性和可维护性。

### 1.1. 技术选型

| 组件 | 技术 | 作用 |
| :--- | :--- | :--- |
| **运行环境** | Docker & Docker Compose | 提供容器化环境，隔离应用和服务，简化管理。 |
| **数据库** | MySQL 8.0 (Docker 镜像) | 持久化存储用户数据、测试历史和配置模板。 |
| **后端服务** | Node.js (Docker 容器) | 运行 Express 和 tRPC 服务，处理业务逻辑和 API 请求。 |
| **前端服务** | Nginx (Docker 容器) | 作为反向代理，处理外部流量，并将 API 请求转发至后端服务。 |
| **部署脚本** | Bash 脚本 | 自动化执行所有部署步骤，实现一键式操作。 |

### 1.2. 部署流程概览

用户只需在腾讯云服务器上执行一个命令，部署脚本将自动完成以下所有任务：

1.  **环境检查与安装**：检查并安装 Docker 和 Docker Compose。
2.  **配置生成**：自动生成 `docker-compose.yml`、后端环境变量文件 (`.env.production`) 和 Nginx 配置文件。
3.  **项目构建**：拉取最新的项目代码，并构建生产环境所需的 Docker 镜像。
4.  **服务启动**：使用 Docker Compose 启动数据库、后端和前端服务。
5.  **数据库初始化**：自动创建数据库、用户，并运行数据迁移以初始化表结构。
6.  **管理员创建**：自动创建默认的管理员账号。
7.  **结果反馈**：显示最终的访问地址和登录凭据。

## 2. 部署脚本与配置文件

为了实现一键部署，我们将创建和优化以下核心文件。

### 2.1. `deploy-all-in-one.sh` (全新一键部署脚本)

该脚本是整个部署流程的入口，它将引导用户完成所有操作。脚本将包含详细的步骤说明、错误处理和用户交互提示。

```bash
#!/bin/bash
# API 压力测试工具 - 腾讯云 Docker 一键部署脚本
# ... (脚本具体内容将在下一步骤中生成)
```

### 2.2. `docker-compose.yml` (优化的服务编排文件)

此文件定义了应用所需的三个核心服务：数据库 (`db`)、后端 (`app`) 和 Web 服务器 (`nginx`)，并管理它们之间的网络和数据卷。

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    # ...

  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    # ...

  nginx:
    image: nginx:alpine
    # ...

volumes:
  mysql_data:
```

### 2.3. `Dockerfile.prod` (生产环境专用 Dockerfile)

与项目中原有的 `Dockerfile` 不同，此文件专门用于构建包含完整前端和后端的生产镜像，并使用 `pm2` 来保证 Node.js 服务的持久运行。

```dockerfile
# 阶段 1: 构建前端和后端
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 阶段 2: 生产镜像
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pm2
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY .env.production ./.env
EXPOSE 3000
CMD ["pm2-runtime", "dist/index.js"]
```

### 2.4. `nginx.conf` (Nginx 反向代理配置)

此配置文件将 Nginx 设置为反向代理。它负责接收所有外部 HTTP 请求，将对 `/api/` 的请求转发给后端 Node.js 服务，同时提供前端静态文件。

```nginx
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://app:3000;
        # ... (代理相关配置)
    }

    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

## 3. 部署步骤详解

以下是为最终用户准备的“傻瓜式”操作指南。

### 3.1. 准备工作

-   一个腾讯云账号。
-   一台已购买的腾讯云服务器（推荐 Ubuntu 22.04 LTS），并确保安全组已放通 80 端口。

### 3.2. 一键部署

1.  **登录服务器**：使用 SSH 或腾讯云网页终端登录您的云服务器。

2.  **下载并运行脚本**：复制并执行以下命令，即可开始全自动部署。

    ```bash
    # 从 GitHub 克隆项目
    apt-get update && apt-get install -y git
    git clone https://github.com/s253567675/api-stress-tester.git

    # 进入项目目录并执行一键部署脚本
    cd api-stress-tester
    bash ./deploy-all-in-one.sh
    ```

3.  **等待完成**：脚本会自动安装依赖、构建镜像并启动服务。整个过程大约需要 5-10 分钟。当您看到 **“🎉 部署完成！”** 的提示时，代表所有服务已成功启动。

### 3.3. 访问应用

部署成功后，您可以通过浏览器访问 `http://<您的服务器公网IP>` 来使用 API 压力测试工具。默认的管理员账号信息如下：

-   **用户名**: `admin`
-   **密码**: `admin123`

## 4. 总结

该方案通过容器化技术和自动化脚本，将复杂的部署流程简化为一条命令，极大地降低了用户的操作门槛。最终交付的不仅是可运行的应用，更是一套完整、可靠且易于维护的部署解决方案，真正意义上的“一键部署”解决方案。
