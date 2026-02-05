#!/bin/bash

#===============================================================================
# API压力测试工具 - Docker一键部署脚本
# 适用于已安装Docker的腾讯云服务器
# 使用方法: bash deploy-docker.sh
#===============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        info "Docker未安装，正在安装..."
        install_docker
    else
        success "Docker已安装: $(docker --version)"
    fi
}

# 安装Docker
install_docker() {
    info "正在安装Docker..."
    
    # 检测系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    fi
    
    case $OS in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq apt-transport-https ca-certificates curl gnupg lsb-release
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
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
    
    # 启动Docker
    systemctl start docker
    systemctl enable docker
    
    success "Docker安装完成"
}

# 构建并运行
deploy() {
    info "正在构建Docker镜像..."
    
    # 停止旧容器（如果存在）
    docker stop api-stress-tester 2>/dev/null || true
    docker rm api-stress-tester 2>/dev/null || true
    
    # 构建镜像
    docker build -t api-stress-tester:latest .
    
    # 运行容器
    docker run -d \
        --name api-stress-tester \
        --restart unless-stopped \
        -p 80:80 \
        api-stress-tester:latest
    
    success "容器启动成功"
}

# 显示信息
show_info() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}🎉 Docker部署完成！${NC}"
    echo "=============================================="
    echo ""
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo -e "访问地址: ${BLUE}http://$SERVER_IP${NC}"
    echo ""
    echo "常用命令:"
    echo "  查看容器状态:  docker ps"
    echo "  查看日志:      docker logs api-stress-tester"
    echo "  重启容器:      docker restart api-stress-tester"
    echo "  停止容器:      docker stop api-stress-tester"
    echo "=============================================="
}

# 主函数
main() {
    echo ""
    echo "=============================================="
    echo "  API压力测试工具 - Docker一键部署"
    echo "=============================================="
    echo ""
    
    check_docker
    deploy
    show_info
}

main "$@"
