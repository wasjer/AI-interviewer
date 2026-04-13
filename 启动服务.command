#!/bin/bash
# 小灵 AI 访谈 - 一键启动脚本
# 双击此文件即可启动服务器和 ngrok 隧道

# ── 配置区 ────────────────────────────────────────────
PORT=3500
NGROK_DOMAIN="absorbing-unsedately-hayley.ngrok-free.dev"
# ─────────────────────────────────────────────────────

cd "$(cd "$(dirname "$0")" && pwd)"

# ── 自动检测本机代理（Clash Verge 7897 / ClashX Pro 7890 等）
if [ -z "$http_proxy" ]; then
  for p in 7897 7890; do
    if curl -sf --noproxy '*' --max-time 1 -o /dev/null "http://127.0.0.1:$p" 2>/dev/null || \
       lsof -i :"$p" -sTCP:LISTEN &>/dev/null; then
      export http_proxy="http://127.0.0.1:$p"
      export https_proxy="http://127.0.0.1:$p"
      echo -e "  ${GREEN}✓ 检测到代理 127.0.0.1:$p${RESET}"
      break
    fi
  done
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

SERVER_PID=""
NGROK_PID=""

cleanup() {
  echo ""
  echo -e "${YELLOW}正在停止所有服务...${RESET}"
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$NGROK_PID" ]  && kill "$NGROK_PID"  2>/dev/null || true
  lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}✓ 已停止。${RESET}"
  exit 0
}
trap cleanup EXIT INT TERM

clear
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║      小灵 AI 访谈 · 正在启动...         ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── 检查依赖 ─────────────────────────────────────────
for cmd in ngrok npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}✗ 未找到 $cmd，请先安装${RESET}"
    read -p "按任意键退出..." -n1; exit 1
  fi
done

# ── 释放端口 ──────────────────────────────────────────
if lsof -Pi :"$PORT" -sTCP:LISTEN -t &>/dev/null; then
  echo -e "${YELLOW}⚠  端口 $PORT 被占用，正在释放...${RESET}"
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── 构建生产版本 ──────────────────────────────────────
echo -e "${BLUE}▶ 构建生产版本（首次约 1-2 分钟，之后增量约 10-30 秒）...${RESET}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ 构建失败${RESET}"
  read -p "按任意键退出..." -n1; exit 1
fi
echo -e "  ${GREEN}✓ 构建完成${RESET}"
echo ""

# ── 启动生产服务器 ────────────────────────────────────
echo -e "${BLUE}▶ 启动生产服务器（端口 $PORT）...${RESET}"
./node_modules/.bin/next start -p "$PORT" >/tmp/ai-interviewer-server.log 2>&1 &
SERVER_PID=$!

printf "  等待服务器启动"
READY=0
for i in $(seq 1 30); do
  if curl -sf --noproxy '*' "http://127.0.0.1:$PORT" &>/dev/null; then
    READY=1; break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo -e "${RED}✗ 服务器启动失败${RESET}"
    tail -20 /tmp/ai-interviewer-server.log
    read -p "按任意键退出..." -n1; exit 1
  fi
  printf "."; sleep 1
done
echo ""

if [ "$READY" -eq 0 ]; then
  echo -e "${RED}✗ 服务器启动超时${RESET}"
  read -p "按任意键退出..." -n1; exit 1
fi
echo -e "  ${GREEN}✓ 服务器已就绪${RESET}"
echo ""

# ── 启动 ngrok 隧道 ───────────────────────────────────
echo -e "${BLUE}▶ 启动 ngrok 隧道（$NGROK_DOMAIN）...${RESET}"
ngrok http --url="$NGROK_DOMAIN" "$PORT" >/tmp/ai-interviewer-ngrok.log 2>&1 &
NGROK_PID=$!

printf "  等待隧道建立"
NGROK_READY=0
for i in $(seq 1 20); do
  if curl -sf --noproxy '*' "http://127.0.0.1:4040/api/tunnels" 2>/dev/null | grep -q "public_url"; then
    NGROK_READY=1; break
  fi
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo ""
    echo -e "${RED}✗ ngrok 启动失败。请确认已运行：ngrok config add-authtoken <token>${RESET}"
    tail -5 /tmp/ai-interviewer-ngrok.log
    read -p "按任意键退出..." -n1; exit 1
  fi
  printf "."; sleep 1
done
echo ""

# ── 显示结果 ─────────────────────────────────────────
PUBLIC_URL="https://$NGROK_DOMAIN"
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
if [ "$NGROK_READY" -eq 1 ]; then
  echo -e "${BOLD}║  ${GREEN}✓ 一切就绪！${RESET}${BOLD}                          ║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  把这个链接发给朋友（每次都一样）："
  echo ""
  echo -e "  ${BOLD}${GREEN}👉  $PUBLIC_URL${RESET}"
  echo ""
  echo -n "$PUBLIC_URL" | pbcopy
  echo -e "  ${YELLOW}（已自动复制到剪贴板）${RESET}"
else
  echo -e "${BOLD}║  ${YELLOW}⚠ 隧道未就绪，请检查 ngrok 配置${RESET}${BOLD}     ║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
fi
echo ""
echo -e "  本地访问：  ${BLUE}http://127.0.0.1:$PORT${RESET}"
echo -e "  ngrok 监控：${BLUE}http://127.0.0.1:4040${RESET}"
echo ""
echo -e "  ${YELLOW}关闭此窗口或按 Ctrl+C 即可停止所有服务${RESET}"
echo ""

wait "$SERVER_PID"
