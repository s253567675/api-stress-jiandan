#!/bin/bash
# ============================================
# API 压力测试工具 - 腾讯云全自动部署脚本
# 适用于 Ubuntu 20.04 / 22.04 LTS
# 一条命令完成所有部署，无需任何手动配置
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置变量（全部自动生成）
PROJECT_NAME="api-stress-tester"
PROJECT_DIR="$HOME/$PROJECT_NAME"
DB_NAME="api_stress_tester"
DB_USER="stress_user"
DB_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
APP_PORT=3000

# 日志文件
LOG_FILE="/tmp/deploy-${PROJECT_NAME}.log"

# 打印函数
info() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "${CYAN}[→]${NC} $1"; }

# 记录日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 打印横幅
print_banner() {
    clear
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                  ║${NC}"
    echo -e "${CYAN}║     ${GREEN}🚀 API 压力测试工具 - 腾讯云全自动部署${CYAN}                      ║${NC}"
    echo -e "${CYAN}║                                                                  ║${NC}"
    echo -e "${CYAN}║     ${NC}无需任何配置，一条命令完成所有部署${CYAN}                          ║${NC}"
    echo -e "${CYAN}║                                                                  ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log "开始部署"
}

# 检查系统
check_system() {
    step "检查系统环境..."
    
    # 检查是否为 Ubuntu
    if [ ! -f /etc/lsb-release ]; then
        error "此脚本仅支持 Ubuntu 系统"
    fi
    
    # 检查 Ubuntu 版本
    UBUNTU_VERSION=$(lsb_release -rs)
    if [[ "${UBUNTU_VERSION}" < "20.04" ]]; then
        error "需要 Ubuntu 20.04 或更高版本，当前版本: ${UBUNTU_VERSION}"
    fi
    
    # 检查权限
    if [ "$EUID" -ne 0 ] && ! sudo -v 2>/dev/null; then
        error "请使用 root 用户或具有 sudo 权限的用户运行"
    fi
    
    info "系统检查通过 (Ubuntu ${UBUNTU_VERSION})"
    log "系统检查通过"
}

# 更新系统
update_system() {
    step "更新系统软件包..."
    
    # 设置完全非交互式模式
    export DEBIAN_FRONTEND=noninteractive
    export NEEDRESTART_MODE=a
    
    # 配置 apt 自动处理配置文件冲突
    sudo apt-get update -qq >> "$LOG_FILE" 2>&1
    
    # 使用 -o 选项确保完全非交互式
    sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        >> "$LOG_FILE" 2>&1 || true
    
    info "系统更新完成"
    log "系统更新完成"
}

# 安装 Node.js 22
install_nodejs() {
    step "安装 Node.js 22.x..."
    
    if command -v node &> /dev/null; then
        NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
        if [ "$NODE_VER" -ge 22 ]; then
            info "Node.js $(node -v) 已安装"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | sudo -E bash - >> "$LOG_FILE" 2>&1
    sudo apt-get install -y nodejs -qq >> "$LOG_FILE" 2>&1
    
    info "Node.js $(node -v) 安装完成"
    log "Node.js 安装完成"
}

# 安装 pnpm
install_pnpm() {
    step "安装 pnpm 包管理器..."
    
    if command -v pnpm &> /dev/null; then
        info "pnpm $(pnpm -v) 已安装"
        return
    fi
    
    sudo npm install -g pnpm >> "$LOG_FILE" 2>&1
    
    info "pnpm $(pnpm -v) 安装完成"
    log "pnpm 安装完成"
}

# 安装 PM2
install_pm2() {
    step "安装 PM2 进程管理器..."
    
    if command -v pm2 &> /dev/null; then
        info "PM2 $(pm2 -v) 已安装"
        return
    fi
    
    sudo npm install -g pm2 >> "$LOG_FILE" 2>&1
    
    info "PM2 $(pm2 -v) 安装完成"
    log "PM2 安装完成"
}

# 安装 MySQL
install_mysql() {
    step "安装 MySQL 数据库..."
    
    # 设置完全非交互式模式
    export DEBIAN_FRONTEND=noninteractive
    export NEEDRESTART_MODE=a
    
    if command -v mysql &> /dev/null; then
        info "MySQL 已安装"
    else
        # 非交互式安装 MySQL
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server \
            -o Dpkg::Options::="--force-confdef" \
            -o Dpkg::Options::="--force-confold" \
            >> "$LOG_FILE" 2>&1
        
        # 启动 MySQL 服务
        sudo systemctl start mysql >> "$LOG_FILE" 2>&1 || true
        sudo systemctl enable mysql >> "$LOG_FILE" 2>&1 || true
        
        # 等待 MySQL 启动
        sleep 3
        
        info "MySQL 安装完成"
        log "MySQL 安装完成"
    fi
    
    # 创建数据库和用户
    step "配置数据库..."
    
    # 检查 MySQL 服务是否运行
    if ! sudo systemctl is-active --quiet mysql; then
        sudo systemctl start mysql >> "$LOG_FILE" 2>&1
        sleep 2
    fi
    
    # 使用 sudo mysql 方式（Ubuntu 默认使用 auth_socket 认证）
    # 分开执行每条SQL命令，避免出错
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >> "$LOG_FILE" 2>&1 || {
        warn "数据库可能已存在，继续..."
    }
    
    # 删除可能存在的旧用户
    sudo mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" >> "$LOG_FILE" 2>&1 || true
    
    # 创建新用户
    sudo mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';" >> "$LOG_FILE" 2>&1 || {
        # 如果失败，尝试旧语法
        sudo mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" >> "$LOG_FILE" 2>&1 || true
    }
    
    # 授权
    sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';" >> "$LOG_FILE" 2>&1
    sudo mysql -e "FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    
    info "数据库配置完成 (数据库: ${DB_NAME}, 用户: ${DB_USER})"
    log "数据库配置完成"
}

# 安装其他依赖
install_dependencies() {
    step "安装其他依赖 (Git, Nginx)..."
    
    # 设置完全非交互式模式
    export DEBIAN_FRONTEND=noninteractive
    export NEEDRESTART_MODE=a
    
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git nginx curl \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        >> "$LOG_FILE" 2>&1
    
    info "依赖安装完成"
    log "依赖安装完成"
}

# 下载/设置项目
setup_project() {
    step "设置项目..."
    
    # 获取脚本所在目录的父目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    
    # 如果脚本在项目的 scripts 目录中运行
    if [ -f "$PARENT_DIR/package.json" ]; then
        PROJECT_DIR="$PARENT_DIR"
        info "使用项目目录: ${PROJECT_DIR}"
        return
    fi
    
    # 如果当前目录就是项目目录
    if [ -f "./package.json" ]; then
        PROJECT_DIR=$(pwd)
        info "使用当前目录作为项目目录: ${PROJECT_DIR}"
        return
    fi
    
    # 如果项目目录已存在
    if [ -d "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/package.json" ]; then
        info "项目目录已存在: ${PROJECT_DIR}"
        return
    fi
    
    # 检查是否有 Git 仓库地址作为参数
    if [ -n "$1" ]; then
        git clone "$1" "$PROJECT_DIR" >> "$LOG_FILE" 2>&1
        info "项目克隆完成"
        return
    fi
    
    # 创建目录等待上传
    mkdir -p "$PROJECT_DIR"
    warn "项目目录已创建: ${PROJECT_DIR}"
    warn "请上传项目文件后重新运行此脚本"
    echo ""
    echo -e "${YELLOW}上传方法：${NC}"
    echo "  使用 scp: scp -r ./api-stress-tester/* ubuntu@服务器IP:${PROJECT_DIR}/"
    echo "  使用 sftp 工具上传到: ${PROJECT_DIR}"
    echo ""
    exit 0
}

# 创建环境变量文件
create_env() {
    step "创建环境变量配置..."
    
    cat > "$PROJECT_DIR/.env" << EOF
# ============================================
# 自动生成的环境变量配置
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
# ============================================

# 数据库配置
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}

# JWT 密钥（自动生成的安全密钥）
JWT_SECRET=${JWT_SECRET}

# 服务配置
PORT=${APP_PORT}
NODE_ENV=production
EOF
    
    info "环境变量配置完成"
    log "环境变量配置完成"
}

# 安装项目依赖
install_project_deps() {
    step "安装项目依赖 (可能需要几分钟)..."
    
    cd "$PROJECT_DIR"
    pnpm install >> "$LOG_FILE" 2>&1
    
    info "项目依赖安装完成"
    log "项目依赖安装完成"
}

# 构建项目
build_project() {
    step "构建生产版本..."
    
    cd "$PROJECT_DIR"
    pnpm build >> "$LOG_FILE" 2>&1
    
    info "项目构建完成"
    log "项目构建完成"
}

# 推送数据库结构
push_database() {
    step "初始化数据库表结构..."
    
    cd "$PROJECT_DIR"
    
    if pnpm db:push >> "$LOG_FILE" 2>&1; then
        info "数据库表结构创建完成"
        log "数据库表结构创建完成"
    else
        warn "数据库表结构创建失败，请检查日志: ${LOG_FILE}"
    fi
}

# 配置 Nginx
setup_nginx() {
    step "配置 Nginx 反向代理..."
    
    # 获取服务器 IP
    SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    sudo tee /etc/nginx/sites-available/${PROJECT_NAME} > /dev/null << EOF
# API 压力测试工具 - Nginx 配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')

server {
    listen 80;
    server_name ${SERVER_IP} _;

    # 客户端请求体大小限制
    client_max_body_size 100M;

    # 日志
    access_log /var/log/nginx/${PROJECT_NAME}-access.log;
    error_log /var/log/nginx/${PROJECT_NAME}-error.log;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 压测场景需要较长超时
        proxy_read_timeout 600s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_read_timeout 5s;
    }
}
EOF

    # 启用站点配置
    sudo ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试并重载配置
    if sudo nginx -t >> "$LOG_FILE" 2>&1; then
        sudo systemctl reload nginx
        info "Nginx 配置完成"
        log "Nginx 配置完成"
    else
        warn "Nginx 配置可能有问题，请检查日志"
    fi
}

# 配置防火墙
setup_firewall() {
    step "配置防火墙规则..."
    
    # 设置完全非交互式模式
    export DEBIAN_FRONTEND=noninteractive
    
    # 检查 ufw 是否安装
    if ! command -v ufw &> /dev/null; then
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ufw \
            -o Dpkg::Options::="--force-confdef" \
            -o Dpkg::Options::="--force-confold" \
            >> "$LOG_FILE" 2>&1
    fi
    
    # 非交互式配置防火墙
    sudo ufw allow 22/tcp >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow 80/tcp >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow 443/tcp >> "$LOG_FILE" 2>&1 || true
    echo "y" | sudo ufw enable >> "$LOG_FILE" 2>&1 || true
    
    info "防火墙配置完成"
    log "防火墙配置完成"
}

# 启动服务
start_service() {
    step "启动应用服务..."
    
    cd "$PROJECT_DIR"
    
    # 停止已有服务
    pm2 delete ${PROJECT_NAME} >> "$LOG_FILE" 2>&1 || true
    
    # 创建 PM2 配置文件
    cat > "$PROJECT_DIR/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [{
    name: '${PROJECT_NAME}',
    script: 'dist/index.js',
    cwd: '${PROJECT_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT}
    },
    error_file: '${PROJECT_DIR}/logs/error.log',
    out_file: '${PROJECT_DIR}/logs/out.log',
    log_file: '${PROJECT_DIR}/logs/combined.log',
    time: true
  }]
};
EOF

    # 创建日志目录
    mkdir -p "$PROJECT_DIR/logs"
    
    # 启动服务
    pm2 start ecosystem.config.cjs >> "$LOG_FILE" 2>&1
    
    # 保存 PM2 配置并设置开机自启
    pm2 save >> "$LOG_FILE" 2>&1
    
    # 获取 startup 命令并执行
    PM2_STARTUP_CMD=$(pm2 startup systemd -u $(whoami) --hp $HOME 2>/dev/null | grep "sudo" | tail -1)
    if [ -n "$PM2_STARTUP_CMD" ]; then
        eval "$PM2_STARTUP_CMD" >> "$LOG_FILE" 2>&1 || true
    fi
    
    info "服务启动完成"
    log "服务启动完成"
}

# 等待服务就绪
wait_for_service() {
    step "等待服务就绪..."
    
    for i in {1..30}; do
        if curl -s http://127.0.0.1:${APP_PORT} > /dev/null 2>&1; then
            info "服务已就绪"
            return 0
        fi
        sleep 1
    done
    
    warn "服务启动超时，请检查日志: pm2 logs ${PROJECT_NAME}"
}

# 保存配置信息
save_config_info() {
    CONFIG_FILE="$PROJECT_DIR/DEPLOY_INFO.txt"
    SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    cat > "$CONFIG_FILE" << EOF
============================================
API 压力测试工具 - 部署信息
============================================
部署时间: $(date '+%Y-%m-%d %H:%M:%S')

【访问地址】
http://${SERVER_IP}

【数据库信息】
数据库名: ${DB_NAME}
数据库用户: ${DB_USER}
数据库密码: ${DB_PASS}
连接字符串: mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}

【JWT 密钥】
${JWT_SECRET}

【常用命令】
查看状态:   pm2 status
查看日志:   pm2 logs ${PROJECT_NAME}
重启服务:   pm2 restart ${PROJECT_NAME}
停止服务:   pm2 stop ${PROJECT_NAME}

【配置文件位置】
环境变量:   ${PROJECT_DIR}/.env
Nginx:      /etc/nginx/sites-available/${PROJECT_NAME}
PM2:        ${PROJECT_DIR}/ecosystem.config.cjs

【日志文件位置】
应用日志:   ${PROJECT_DIR}/logs/
Nginx日志:  /var/log/nginx/${PROJECT_NAME}-*.log
部署日志:   ${LOG_FILE}

============================================
请妥善保管此文件中的敏感信息！
============================================
EOF
    
    chmod 600 "$CONFIG_FILE"
    log "配置信息已保存到: ${CONFIG_FILE}"
}

# 打印完成信息
print_success() {
    SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║                    🎉 部署成功完成！                             ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}访问地址:${NC}  ${GREEN}http://${SERVER_IP}${NC}"
    echo ""
    echo -e "  ${CYAN}数据库信息:${NC}"
    echo -e "    数据库名:   ${DB_NAME}"
    echo -e "    用户名:     ${DB_USER}"
    echo -e "    密码:       ${DB_PASS}"
    echo ""
    echo -e "  ${CYAN}常用命令:${NC}"
    echo -e "    查看状态:   ${YELLOW}pm2 status${NC}"
    echo -e "    查看日志:   ${YELLOW}pm2 logs ${PROJECT_NAME}${NC}"
    echo -e "    重启服务:   ${YELLOW}pm2 restart ${PROJECT_NAME}${NC}"
    echo ""
    echo -e "  ${CYAN}配置信息已保存到:${NC}"
    echo -e "    ${PROJECT_DIR}/DEPLOY_INFO.txt"
    echo ""
    echo -e "  ${YELLOW}⚠️  请妥善保管数据库密码和 JWT 密钥！${NC}"
    echo ""
    
    log "部署完成"
}

# 主函数
main() {
    print_banner
    
    check_system
    update_system
    install_nodejs
    install_pnpm
    install_pm2
    install_mysql
    install_dependencies
    setup_project "$1"
    create_env
    install_project_deps
    build_project
    push_database
    setup_nginx
    setup_firewall
    start_service
    wait_for_service
    save_config_info
    print_success
}

# 错误处理
trap 'echo -e "${RED}部署过程中发生错误，请查看日志: ${LOG_FILE}${NC}"; exit 1' ERR

# 运行
main "$@"
