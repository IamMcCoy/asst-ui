# Deployment Guide

이 문서는 SAUS Frontend를 다른 서버에 배포하는 방법을 설명합니다.

## 방법 1: tar 파일로 전송 (추천)

### 1. 현재 서버에서 이미지 저장

```bash
# 이미지를 tar 파일로 저장
make save

# 또는 특정 버전 지정
make save TAG=v1.0.0
```

생성된 파일: `saus-frontend-v0.9.0.tar` (약 21MB)

### 2. 원격 서버로 전송

```bash
# SCP 사용
scp saus-frontend-v0.9.0.tar user@원격서버IP:/home/user/

# rsync 사용 (더 빠름)
rsync -avz --progress saus-frontend-v0.9.0.tar user@원격서버IP:/home/user/
```

### 3. 원격 서버에서 실행

원격 서버에 SSH 접속:

```bash
ssh user@원격서버IP
```

이미지 로드:

```bash
# tar 파일에서 이미지 로드
docker load -i saus-frontend-v0.9.0.tar

# 이미지 확인
docker images | grep saus-frontend
```

컨테이너 실행:

```bash
# 기본 설정으로 실행
docker run -d \
  -p 8080:80 \
  -e REACT_APP_API_BASE_URL=http://10.1.35.73:39990 \
  -e REACT_APP_USER_ID=demo-user \
  --name saus-frontend-container \
  saus-frontend:v0.9.0

# 또는 다른 설정으로 실행
docker run -d \
  -p 80:80 \
  -e REACT_APP_API_BASE_URL=http://your-api-server:8000 \
  -e REACT_APP_USER_ID=production-user \
  --name saus-frontend-container \
  --restart unless-stopped \
  saus-frontend:v0.9.0
```

### 4. 확인

```bash
# 컨테이너 상태 확인
docker ps

# 로그 확인
docker logs saus-frontend-container

# 브라우저로 접속
# http://서버IP:8080
```

---

## 방법 2: Docker Registry 사용

### 1. Docker Hub에 푸시

```bash
# Docker Hub 로그인
docker login

# 이미지 푸시 (your-username을 실제 계정으로 변경)
make push REGISTRY=your-username
```

### 2. 원격 서버에서 풀

```bash
# 이미지 다운로드
docker pull your-username/saus-frontend:v0.9.0

# 실행
docker run -d \
  -p 8080:80 \
  -e REACT_APP_API_BASE_URL=http://10.1.35.73:39990 \
  -e REACT_APP_USER_ID=demo-user \
  --name saus-frontend-container \
  your-username/saus-frontend:v0.9.0
```

---

## 환경 변수 설정

컨테이너 실행 시 다음 환경 변수를 설정할 수 있습니다:

| 환경 변수 | 설명 | 기본값 |
|----------|------|--------|
| `REACT_APP_API_BASE_URL` | 백엔드 API 서버 URL | `http://localhost:8000` |
| `REACT_APP_USER_ID` | 사용자 ID | `demo-user` |

### 예시

```bash
# 개발 환경
docker run -d -p 8080:80 \
  -e REACT_APP_API_BASE_URL=http://dev-api:8000 \
  -e REACT_APP_USER_ID=dev-user \
  --name saus-frontend-dev \
  saus-frontend:v0.9.0

# 프로덕션 환경
docker run -d -p 80:80 \
  -e REACT_APP_API_BASE_URL=http://prod-api:8000 \
  -e REACT_APP_USER_ID=prod-user \
  --name saus-frontend-prod \
  --restart always \
  saus-frontend:v0.9.0
```

---

## 유용한 Docker 명령어

```bash
# 컨테이너 중지
docker stop saus-frontend-container

# 컨테이너 재시작
docker restart saus-frontend-container

# 컨테이너 삭제
docker rm -f saus-frontend-container

# 로그 실시간 보기
docker logs -f saus-frontend-container

# 컨테이너 내부 접속
docker exec -it saus-frontend-container sh

# 포트 확인
docker port saus-frontend-container

# 리소스 사용량 확인
docker stats saus-frontend-container
```

---

## 트러블슈팅

### 포트가 이미 사용 중인 경우

```bash
# 8080 포트 사용 중인 프로세스 확인
lsof -i :8080  # Mac/Linux
netstat -ano | findstr :8080  # Windows

# 다른 포트로 실행
docker run -d -p 3000:80 ... saus-frontend:v0.9.0
```

### 이미지가 로드되지 않는 경우

```bash
# tar 파일 확인
ls -lh saus-frontend-v0.9.0.tar

# 압축 해제 없이 확인
tar -tf saus-frontend-v0.9.0.tar | head

# 강제로 다시 로드
docker rmi saus-frontend:v0.9.0
docker load -i saus-frontend-v0.9.0.tar
```

### 환경 변수가 적용되지 않는 경우

```bash
# 컨테이너 내부에서 확인
docker exec saus-frontend-container cat /usr/share/nginx/html/env-config.js

# 컨테이너 재시작
docker restart saus-frontend-container
```

---

## 자동 시작 설정

서버 재부팅 시 자동으로 컨테이너를 시작하려면:

```bash
docker run -d \
  -p 8080:80 \
  --restart unless-stopped \
  -e REACT_APP_API_BASE_URL=http://10.1.35.73:39990 \
  -e REACT_APP_USER_ID=demo-user \
  --name saus-frontend-container \
  saus-frontend:v0.9.0
```

`--restart` 옵션:
- `no`: 재시작 안 함 (기본값)
- `on-failure`: 오류 발생 시에만 재시작
- `unless-stopped`: 수동으로 중지하지 않는 한 항상 재시작
- `always`: 항상 재시작

---

## 보안 권장사항

1. **HTTPS 사용**: Nginx 앞에 리버스 프록시(예: Caddy, Traefik) 설정
2. **방화벽 설정**: 필요한 포트만 개방
3. **환경 변수 보안**: 민감한 정보는 Docker secrets 또는 환경 파일 사용
4. **정기 업데이트**: 정기적으로 이미지 재빌드 및 배포

---

## 문의

문제가 발생하면 로그를 확인하고 GitHub Issues에 보고해주세요.
