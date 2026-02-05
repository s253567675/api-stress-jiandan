#!/bin/bash
# ============================================
# API 压力测试工具 - 腾讯云一键部署脚本
# 适用于 Ubuntu 22.04 LTS
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 打印横幅
print_banner() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║        API 压力测试工具 - 腾讯云一键部署脚本              ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 检查系统要求
check_requirements() {
    step "检查系统要求..."
    
    # 检查是否为 Ubuntu
    if [ ! -f /etc/lsb-release ]; then
        error "此脚本仅支持 Ubuntu 系统"
    fi
    
    # 检查是否有 sudo 权限
    if [ "$EUID" -ne 0 ] && ! sudo -v 2>/dev/null; then
        error "请使用 root 用户或具有 sudo 权限的用户运行此脚本"
    fi
    
    info "系统检查通过 ✓"
}

# 更新系统
update_system() {
    step "更新系统包..."
    sudo apt update -qq
    sudo apt upgrade -y -qq
    info "系统更新完成 ✓"
}

# 安装 Node.js
install_nodejs() {
    step "安装 Node.js 22.x..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
        if [ "$NODE_VERSION" -ge 22 ]; then
            info "Node.js $(node -v) 已安装 ✓"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null 2>&1
    sudo apt install -y nodejs -qq
    info "Node.js $(node -v) 安装完成 ✓"
}

# 安装 pnpm
install_pnpm() {
    step "安装 pnpm..."
    
    if command -v pnpm &> /dev/null; then
        info "pnpm $(pnpm -v) 已安装 ✓"
        return
    fi
    
    sudo npm install -g pnpm > /dev/null 2>&1
    info "pnpm $(pnpm -v) 安装完成 ✓"
}

# 安装 PM2
install_pm2() {
    step "安装 PM2 进程管理器..."
    
    if command -v pm2 &> /dev/null; then
        info "PM2 $(pm2 -v) 已安装 ✓"
        return
    fi
    
    sudo npm install -g pm2 > /dev/null 2>&1
    info "PM2 $(pm2 -v) 安装完成 ✓"
}

# 安装其他依赖
install_dependencies() {
    step "安装其他依赖..."
    sudo apt install -y git nginx -qq
    info "依赖安装完成 ✓"
}

# 设置项目目录
setup_project() {
    step "设置项目目录..."
    
    PROJECT_DIR="$HOME/api-stress-tester"
    
    if [ -d "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/package.json" ]; then
        info "项目目录已存在: $PROJECT_DIR ✓"
        return
    fi
    
    echo ""
    echo "请选择项目来源："
    echo "  1) 从 Git 仓库克隆"
    echo "  2) 手动上传（稍后通过 SFTP 上传）"
    echo ""
    read -p "请输入选项 [1/2]: " choice
    
    case $choice in
        1)
            read -p "请输入 Git 仓库地址: " GIT_URL
            if [ -n "$GIT_URL" ]; then
                git clone "$GIT_URL" "$PROJECT_DIR"
                info "项目克隆完成 ✓"
            else
                error "Git 仓库地址不能为空"
            fi
            ;;
        2)
            mkdir -p "$PROJECT_DIR"
            warn "已创建空目录: $PROJECT_DIR"
            warn "请使用 SFTP 工具上传项目文件后，重新运行此脚本"
            exit 0
            ;;
        *)
            error "无效选项"
            ;;
    esac
}

# 配置环境变量
setup_env() {
    step "配置环境变量..."
    
    PROJECT_DIR="$HOME/api-stress-tester"
    ENV_FILE="$PROJECT_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        warn ".env 文件已存在，跳过创建"
        return
    fi
    
    echo ""
    echo "请配置数据库连接信息："
    echo ""
    
    read -p "数据库主机地址 [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    read -p "数据库端口 [3306]: " DB_PORT
    DB_PORT=${DB_PORT:-3306}
    
    read -p "数据库名称 [api_stress_tester]: " DB_NAME
    DB_NAME=${DB_NAME:-api_stress_tester}
    
    read -p "数据库用户名: " DB_USER
    
    read -s -p "数据库密码: " DB_PASS
    echo ""
    
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > "$ENV_FILE" << EOF
# 数据库配置
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# JWT 密钥
JWT_SECRET=${JWT_SECRET}

# 服务配置
PORT=3000
NODE_ENV=production
EOF
    
    info "环境变量配置完成 ✓"
}

# 安装项目依赖
install_project_deps() {
    step "安装项目依赖..."
    
    PROJECT_DIR="$HOME/api-stress-tester"
    cd "$PROJECT_DIR"
    
    pnpm install > /dev/null 2>&1
    info "项目依赖安装完成 ✓"
}

# 构建项目
build_project() {
    step "构建项目..."
    
    PROJECT_DIR="$HOME/api-stress-tester"
    cd "$PROJECT_DIR"
    
    pnpm build > /dev/null 2>&1
    info "项目构建完成 ✓"
}

# 推送数据库
push_database() {
    step "推送数据库结构..."
    
    PROJECT_DIR="$HOME/api-stress-tester"
    cd "$PROJECT_DIR"
    
    if pnpm db:push > /dev/null 2>&1; then
        info "数据库结构推送完成 ✓"
    else
        warn "数据库推送失败，请检查数据库连接配置"
    fi
}

# 配置 Nginx
setup_nginx() {
    step "配置 Nginx 反向代理..."
    
    sudo tee /etc/nginx/sites-available/api-stress-tester > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # 增加客户端请求体大小限制
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 增加超时时间
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

    sudo ln -sf /etc/nginx/sites-available/api-stress-tester /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    if sudo nginx -t > /dev/null 2>&1; then
        sudo systemctl reload nginx
        info "Nginx 配置完成 ✓"
    else
        error "Nginx 配置错误，请检查"
    fi
}

# 配置防火墙
setup_firewall() {
    step "配置防火墙..."
    
    sudo ufw allow 22/tcp > /dev/null 2>&1
    sudo ufw allow 80/tcp > /dev/null 2>&1
    sudo ufw allow 443/tcp > /dev/null 2>&1
    sudo ufw --force enable > /dev/null 2>&1
    
    info "防火墙配置完成 ✓"
}

# 启动服务
start_service() {
    step "启动服务..."
    
    PROJECT_DIR="$HOME/api-stress-tester"
    cd "$PROJECT_DIR"
    
    # 停止已有服务
    pm2 delete api-stress-tester 2>/dev/null || true
    
    # 启动新服务
    pm2 start dist/index.js --name api-stress-tester > /dev/null 2>&1
    
    # 保存 PM2 配置
    pm2 save > /dev/null 2>&1
    
    # 设置开机自启
    PM2_STARTUP=$(pm2 startup | grep "sudo" | tail -1)
    if [ -n "$PM2_STARTUP" ]; then
        eval "$PM2_STARTUP" > /dev/null 2>&1
    fi
    
    info "服务启动完成 ✓"
}

# 打印完成信息
print_success() {
    # 获取服务器 IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║                    🎉 部署成功！                           ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "访问地址: ${BLUE}http://${SERVER_IP}${NC}"
    echo ""
    echo "常用命令："
    echo "  查看状态:   pm2 status"
    echo "  查看日志:   pm2 logs api-stress-tester"
    echo "  重启服务:   pm2 restart api-stress-tester"
    echo "  停止服务:   pm2 stop api-stress-tester"
    echo ""
    echo "如需配置域名和 HTTPS，请参考部署文档。"
    echo ""
}

# 主函数
main() {
    print_banner
    check_requirements
    update_system
    install_nodejs
    install_pnpm
    install_pm2
    install_dependencies
    setup_project
    setup_env
    install_project_deps
    build_project
    push_database
    setup_nginx
    setup_firewall
    start_service
    print_success
}

# 运行主函数
main "$@"
