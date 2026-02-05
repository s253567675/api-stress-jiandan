#!/bin/bash

#===============================================================================
# API压力测试工具 - 腾讯云一键部署脚本
# 适用系统: Ubuntu 20.04/22.04, CentOS 7/8, Debian 10/11
# 使用方法: curl -sSL https://your-domain/deploy.sh | bash
#           或: bash deploy-tencent.sh
#===============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "请使用 root 用户运行此脚本，或使用 sudo bash deploy-tencent.sh"
    fi
}

# 检测系统类型
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

# 安装依赖
install_dependencies() {
    info "正在安装系统依赖..."
    
    case $OS in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq curl git nginx
            ;;
        centos|rhel|fedora)
            yum install -y -q curl git nginx
            ;;
        *)
            error "不支持的操作系统: $OS"
            ;;
    esac
    
    success "系统依赖安装完成"
}

# 安装 Node.js
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        info "Node.js 已安装: $NODE_VERSION"
        return
    fi
    
    info "正在安装 Node.js 20.x..."
    
    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y -qq nodejs
            ;;
        centos|rhel|fedora)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            yum install -y -q nodejs
            ;;
    esac
    
    # 安装 pnpm
    npm install -g pnpm
    
    success "Node.js 安装完成: $(node -v)"
}

# 配置变量
PROJECT_NAME="api-stress-tester"
INSTALL_DIR="/var/www/$PROJECT_NAME"
REPO_URL="https://github.com/your-username/api-stress-tester.git"  # 替换为你的仓库地址
PORT=3000
DOMAIN=""

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            --repo)
                REPO_URL="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
}

# 下载项目代码
download_project() {
    info "正在下载项目代码..."
    
    # 如果目录已存在，先备份
    if [ -d "$INSTALL_DIR" ]; then
        warning "项目目录已存在，正在备份..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    fi
    
    # 创建目录
    mkdir -p "$INSTALL_DIR"
    
    # 如果有本地文件，直接复制
    if [ -d "/tmp/api-stress-tester" ]; then
        cp -r /tmp/api-stress-tester/* "$INSTALL_DIR/"
    elif [ -n "$REPO_URL" ] && [ "$REPO_URL" != "https://github.com/your-username/api-stress-tester.git" ]; then
        git clone "$REPO_URL" "$INSTALL_DIR"
    else
        error "请指定项目仓库地址: --repo <git-url>"
    fi
    
    success "项目代码下载完成"
}

# 构建项目
build_project() {
    info "正在构建项目..."
    
    cd "$INSTALL_DIR"
    
    # 安装依赖
    pnpm install
    
    # 构建生产版本
    pnpm build
    
    success "项目构建完成"
}

# 配置 Nginx
configure_nginx() {
    info "正在配置 Nginx..."
    
    # 生成 Nginx 配置
    cat > /etc/nginx/sites-available/$PROJECT_NAME << EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};
    
    # 静态文件目录
    root $INSTALL_DIR/dist/public;
    index index.html;
    
    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA 路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

    # 创建软链接
    ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
    
    # 删除默认配置（如果存在）
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    nginx -t
    
    # 重启 Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    success "Nginx 配置完成"
}

# 配置防火墙
configure_firewall() {
    info "正在配置防火墙..."
    
    case $OS in
        ubuntu|debian)
            if command -v ufw &> /dev/null; then
                ufw allow 80/tcp
                ufw allow 443/tcp
                ufw --force enable
            fi
            ;;
        centos|rhel|fedora)
            if command -v firewall-cmd &> /dev/null; then
                firewall-cmd --permanent --add-service=http
                firewall-cmd --permanent --add-service=https
                firewall-cmd --reload
            fi
            ;;
    esac
    
    success "防火墙配置完成"
}

# 显示部署信息
show_info() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo "=============================================="
    echo ""
    echo "访问地址:"
    if [ -n "$DOMAIN" ]; then
        echo -e "  ${BLUE}http://$DOMAIN${NC}"
    else
        # 获取服务器IP
        SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
        echo -e "  ${BLUE}http://$SERVER_IP${NC}"
    fi
    echo ""
    echo "项目目录: $INSTALL_DIR"
    echo ""
    echo "常用命令:"
    echo "  重启 Nginx:    systemctl restart nginx"
    echo "  查看状态:      systemctl status nginx"
    echo "  查看日志:      tail -f /var/log/nginx/error.log"
    echo ""
    echo "=============================================="
}

# 主函数
main() {
    echo ""
    echo "=============================================="
    echo "  API压力测试工具 - 腾讯云一键部署"
    echo "=============================================="
    echo ""
    
    parse_args "$@"
    check_root
    detect_os
    install_dependencies
    install_nodejs
    download_project
    build_project
    configure_nginx
    configure_firewall
    show_info
}

# 运行主函数
main "$@"
