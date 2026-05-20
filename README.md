# SAUS Frontend

**SAUS (Secu Security Assistant)** 챗봇 UI — 보안 분석 어시스턴트의 프론트엔드입니다.
백엔드 챗 서비스와 HTTP / SSE 로 통신하며, **비동기 task 큐** 방식으로 응답을 스트리밍합니다.

- **Stack**: React 18 · TypeScript · MUI 5 · Create React App
- **차트**: Chart.js + react-chartjs-2
- **마크다운**: react-markdown + remark-gfm + rehype-highlight / rehype-raw

---

## 빠르게 시작하기

```bash
npm install
npm start                  # http://localhost:3000
```

개발용 환경변수는 프로젝트 루트의 `.env` 에 둡니다 (CRA 규칙: `REACT_APP_` 접두사 필수).

```env
REACT_APP_API_BASE_URL=http://192.168.1.70:31998
REACT_APP_USER_ID=demo-user
REACT_APP_JWT_TOKEN=eyJhbGciOi...
```

### 기타 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm start` | 개발 서버 (Hot Reload) |
| `npm run build` | 프로덕션 빌드 → `build/` |
| `npm test` | Jest watch 모드 |
| `npm test -- --watchAll=false` | 단발 테스트 |
| `npx tsc --noEmit` | 린트 대신 사용하는 타입 체크 |

별도 lint 스크립트는 없습니다. CRA 가 dev 서버 동작 중 인라인으로 ESLint 를 돌립니다.

---

## 런타임 환경변수 주입 (중요)

이 앱은 **CRA build-time env 만으로는 동작이 충분하지 않습니다.** Docker 컨테이너 안에서는
`entrypoint.sh` 가 컨테이너 환경변수를 읽어 `/usr/share/nginx/html/env-config.js` 를
생성하고, 그 스크립트가 React 번들 로드 전에 `window.__ENV__` 를 설정합니다.

설정 조회 우선순위는 다음과 같습니다 (`src/App.tsx`, `src/services/api.ts` 참고).

1. `window.__ENV__?.X` — 런타임 (Docker)
2. `process.env.REACT_APP_X` — 개발 / CRA 빌드 타임
3. 코드 안의 하드코딩된 기본값

지원 키: `API_BASE_URL`, `USER_ID`, `JWT_TOKEN` (타입은 `src/types/env.d.ts`).

> ⚠ 새 런타임 키를 추가하려면 **세 군데**를 같이 손봐야 합니다.
> `entrypoint.sh` (heredoc) · `RuntimeEnv` 인터페이스 (`env.d.ts`) · 실제 조회 코드.
> 어느 하나라도 빠지면 Docker 배포에서 조용히 깨집니다.

---

## Docker 배포

배포·이미지 운반·레지스트리 작업은 모두 Makefile 로 묶여 있습니다. 자주 쓰는 것만:

```bash
make help                                     # 전체 타깃 보기
make deploy                                   # build + run-bg
make run-bg HOST_PORT=3000 \
            API_URL=http://api.example.com:8000 \
            USER_ID=prod-user
make logs
make save                                     # 이미지 → tar (전송용)
make push REGISTRY=registry.seculayer.com:31500 TAG=v1.2.7
```

자세한 배포 시나리오 (tar 전송 / 사내 레지스트리 push-pull / 환경변수 매트릭스) 는
[`DEPLOYMENT.md`](./DEPLOYMENT.md) 를 참고하세요.

---

## 인증

- `window.__ENV__.JWT_TOKEN` 에서 Bearer 토큰을 읽어 모든 API 호출에 자동으로 붙입니다
  (`authHeaders` in `src/services/api.ts`).
- `isAdminToken()` 이 JWT payload 를 클라이언트에서 디코딩해 `aud === 'admin'` 인지 확인합니다.
  **서명 검증은 하지 않습니다** — 어디까지나 UI 표시 분기용이고 실제 권한은 백엔드가 강제합니다.
- 모든 요청에 Bearer 가 필요하므로 브라우저 기본 `EventSource` 는 사용할 수 없습니다.
  스트리밍은 전부 `fetch` + `ReadableStream` 으로 구현돼 있습니다 (`parseSseStream`,
  `dispatchSseEvent`).

---

## 채팅 흐름 (비동기 task 큐)

채팅 호출은 한 번의 스트리밍 POST 가 아니라 다음 단계로 나뉩니다.

1. `POST /asst/chat/stream` → `{ task_id, session_id, status: "running" }` 즉시 반환
   (이미 진행 중인 task 가 있으면 `409` + `detail.active_task_id`)
2. `GET /asst/chat/tasks/{task_id}/stream` (SSE) → 첫 이벤트는 항상 `snapshot`, 이후
   `progress` / `answer_delta` / `final` / `cancelled` / `error`
3. `POST /asst/chat/tasks/{task_id}/cancel` → 백엔드가 `cancelled` 이벤트를 쏘고 SSE 가
   자연 종료. **추가로 `abort()` 하지 말 것** — 이벤트를 받고 종료하는 게 정상 경로
4. `GET /asst/users/{user_id}/sessions/{session_id}/active-task` → 세션 진입 / 탭 가시성
   복원 시 진행 중인 task 에 재구독

완료된 task 는 1시간 동안 재구독 가능 (`snapshot` 한 발만 받고 닫힘). 1시간이 지나면
404 가 떨어지고 `getSessionHistory` 로 폴백합니다.

상태 머신과 race condition (snapshot vs loadMessages, sessionId closure rule 등) 까지
포함한 프론트엔드 측 설계 노트는 [`CLAUDE.md`](./CLAUDE.md) 에 정리돼 있습니다.

---

## 백엔드 운영 제약: 워커 1개

백엔드의 `TaskRegistry` 는 in-memory dict 이므로 uvicorn / gunicorn 을 멀티 워커로 띄우면
POST 와 SSE GET 이 서로 다른 워커에 떨어져 404 가 납니다. 프로덕션은 `--workers 1` 로
운영합니다. 진행 중 "task not found or expired" 가 산발적으로 뜬다면 프론트 버그보다
워커 수를 먼저 의심하세요.

---

## 테마

테마는 두 레이어를 **수동으로 동기화**하는 구조입니다.

1. CSS 변수 / 디자인 토큰: `src/index.css`, `body.theme-light` / `body.theme-dark` 로 토글
2. MUI palette: `App.tsx` 의 `buildTheme(mode)`

두 곳에 같은 hex 값을 둬서, MUI 그대로 쓰는 컴포넌트 (Dialog, Menu, Tooltip, Table) 와
새로 만든 커스텀 컴포넌트 (Composer, Topbar, SessionSidebar, ChatMessage, ToolCard) 의
색감을 맞춥니다. 브랜드 컬러를 바꾼다면 **두 군데를 같이** 갱신해야 합니다.

- 새 컴포넌트: 옆에 `Component.css` 파일을 두고 평문 class 사용
- 옛 컴포넌트: MUI `sx` prop 그대로
- 입력창: `MessageInput.tsx` (legacy) / `Composer.tsx` (현행) — Composer 를 사용

폰트는 Pretendard, 시스템 폰트 폴백 체인.
