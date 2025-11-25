#!/bin/sh

# entrypoint.sh
# 런타임에 환경 변수를 JavaScript 파일로 생성하여 주입

set -e

echo "Generating runtime environment configuration..."

# 환경 변수 기본값 설정
API_BASE_URL="${REACT_APP_API_BASE_URL:-http://localhost:8000}"
USER_ID="${REACT_APP_USER_ID:-demo-user}"

echo "API_BASE_URL: ${API_BASE_URL}"
echo "USER_ID: ${USER_ID}"

# env-config.js 파일 생성
cat <<EOF > /usr/share/nginx/html/env-config.js
// Runtime environment configuration
// This file is auto-generated at container startup
window.__ENV__ = {
  API_BASE_URL: "${API_BASE_URL}",
  USER_ID: "${USER_ID}"
};
EOF

echo "Environment configuration complete!"
echo "Starting nginx..."

# nginx 실행
exec nginx -g "daemon off;"
