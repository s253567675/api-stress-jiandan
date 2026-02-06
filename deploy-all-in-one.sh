#!/bin/bash

# ============================================================================
# API 压力测试工具 - 腾讯云 Docker 一键部署脚本
# 作者: Manus AI
# 版本: 1.0
# 使用方法: sudo bash deploy-all-in-one.sh
# ============================================================================

set -e

# --- 配置变量 --- #
DB_ROOT_PASSWORD="RootPassword123"
DB_DATABASE="api_stress_tester"
DB_USER="stresstest"
DB_PASSWORD="StressTest2024"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
JWT_SECRET="api-stress-tester-jwt-secret-$(date +%s)"

# --- 颜色定义 --- #
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- 输出函数 --- #
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- 脚本函数 --- #

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "请使用 root 用户运行此脚本: sudo bash $0"
    fi
    success "Root 权限检查通过"
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        error "无法检测操作系统类型"
    fi
    info "检测到操作系统: $OS $VERSION"
}

# 安装 Docker 和 Docker Compose
install_docker() {
    if command -v docker &> /dev/null; then
        success "Docker 已安装: $(docker --version)"
    else
        info "正在安装 Docker..."
        
        case $OS in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y -qq apt-transport-https ca-certificates curl gnupg lsb-release
                
                # 添加 Docker 官方 GPG 密钥
                mkdir -p /etc/apt/keyrings
                curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                
                # 设置 Docker 仓库
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
                
                apt-get update -qq
                apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
                ;;
            centos|rhel|fedora)
                yum install -y -q yum-utils
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
                ;;
            *)
                error "不支持的操作系统: $OS"
                ;;
        esac
        
        # 启动 Docker 服务
        systemctl start docker
        systemctl enable docker
        
        success "Docker 安装完成"
    fi
}

# 创建生产环境 Dockerfile
create_dockerfile() {
    info "正在创建 Dockerfile..."
    
    cat > Dockerfile.prod << 'DOCKERFILE'
# 阶段 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
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
COPY --from=builder /app/drizzle ./drizzle
EXPOSE 3000
CMD ["pm2-runtime", "dist/index.js"]
DOCKERFILE

    success "Dockerfile 创建完成"
}

# 创建环境变量文件
create_env_file() {
    info "正在创建环境变量文件..."
    
    cat > .env.production << EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=${JWT_SECRET}
DATABASE_URL=mysql://${DB_USER}:${DB_PASSWORD}@db:3306/${DB_DATABASE}
EOF

    success "环境变量文件创建完成"
}

# 创建 Docker Compose 配置
create_docker_compose() {
    info "正在创建 Docker Compose 配置..."
    
    cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  db:
    image: mysql:8.0
    container_name: stress_tester_db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_DATABASE}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: stress_tester_app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: mysql://${DB_USER}:${DB_PASSWORD}@db:3306/${DB_DATABASE}
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: stress_tester_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.docker.conf:/etc/nginx/conf.d/default.conf:ro
      - ./dist/public:/usr/share/nginx/html:ro
    depends_on:
      - app
    networks:
      - app-network

volumes:
  mysql_data:

networks:
  app-network:
    driver: bridge
EOF

    success "Docker Compose 配置创建完成"
}

# 创建 Nginx 配置
create_nginx_config() {
    info "正在创建 Nginx 配置..."
    
    cat > nginx.docker.conf << 'NGINX'
server {
    listen 80;
    server_name _;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # API 请求代理到后端
    location /api/ {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # 静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

    success "Nginx 配置创建完成"
}

# 创建管理员账号脚本
create_admin_script() {
    info "正在创建管理员账号脚本..."
    
    cat > scripts/docker-create-admin.ts << EOF
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import * as bcrypt from "bcryptjs";
import { users } from "../drizzle/schema";

async function createAdmin() {
  const maxRetries = 30;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
      }

      const db = drizzle(process.env.DATABASE_URL);
      
      const username = "${ADMIN_USERNAME}";
      const password = "${ADMIN_PASSWORD}";
      const hashedPassword = await bcrypt.hash(password, 10);
      const openId = \`local_\${username}_\${Date.now()}\`;

      await db.insert(users).values({
        openId,
        username,
        password: hashedPassword,
        name: "Administrator",
        role: "admin",
        loginMethod: "local",
        isActive: 1,
      });

      console.log("✅ 管理员账号创建成功!");
      console.log("用户名: " + username);
      console.log("密码: " + password);
      process.exit(0);
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        console.log("✅ 管理员账号已存在");
        process.exit(0);
      } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        retries++;
        console.log(\`等待数据库连接... (\${retries}/\${maxRetries})\`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error("创建管理员账号失败:", error);
        process.exit(1);
      }
    }
  }
  
  console.error("数据库连接超时");
  process.exit(1);
}

createAdmin();
EOF

    success "管理员账号脚本创建完成"
}

# 构建并启动服务
build_and_start() {
    info "正在构建 Docker 镜像并启动服务..."
    info "这可能需要几分钟时间，请耐心等待..."
    
    # 停止旧容器（如果存在）
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    
    # 构建并启动
    docker compose -f docker-compose.prod.yml up -d --build
    
    success "服务启动成功"
}

# 初始化数据库
init_database() {
    info "正在等待数据库就绪..."
    sleep 15
    
    info "正在运行数据库迁移..."
    docker compose -f docker-compose.prod.yml exec -T app sh -c "cd /app && npx drizzle-kit generate && npx drizzle-kit migrate" || true
    
    info "正在创建管理员账号..."
    docker compose -f docker-compose.prod.yml exec -T app npx tsx scripts/docker-create-admin.ts || true
    
    success "数据库初始化完成"
}

# 显示部署结果
show_result() {
    # 获取服务器 IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo "=============================================="
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo "=============================================="
    echo ""
    echo -e "访问地址: ${BLUE}http://${SERVER_IP}${NC}"
    echo ""
    echo "登录凭据:"
    echo -e "  用户名: ${GREEN}${ADMIN_USERNAME}${NC}"
    echo -e "  密码:   ${GREEN}${ADMIN_PASSWORD}${NC}"
    echo ""
    echo "常用命令:"
    echo "  查看服务状态: docker compose -f docker-compose.prod.yml ps"
    echo "  查看日志:     docker compose -f docker-compose.prod.yml logs -f"
    echo "  重启服务:     docker compose -f docker-compose.prod.yml restart"
    echo "  停止服务:     docker compose -f docker-compose.prod.yml down"
    echo ""
    echo "=============================================="
}

# --- 主函数 --- #
main() {
    echo ""
    echo "=============================================="
    echo "  API 压力测试工具 - 腾讯云一键部署"
    echo "=============================================="
    echo ""
    
    check_root
    detect_os
    install_docker
    create_dockerfile
    create_env_file
    create_docker_compose
    create_nginx_config
    create_admin_script
    build_and_start
    init_database
    show_result
}

# 运行主函数
main "$@"
