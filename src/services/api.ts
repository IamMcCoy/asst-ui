import {
    ChatRequest,
    Session,
    Message,
    FeedbackRequest,
    UpdateTitleRequest,
    ApiKeysRequest,
    ToolsResponse,
    ExtraInfoMap,
    UploadedFile,
    AdminLogsQuery,
    AdminLogsResponse,
    StartTaskResponse,
    StartTaskConflict,
    ActiveTaskResponse,
    TaskSnapshot,
} from '../types/api';

// 런타임 환경 변수 사용 (window.__ENV__)
// 개발 환경에서는 process.env 사용
const BASE_URL = window.__ENV__?.API_BASE_URL ||
                 process.env.REACT_APP_API_BASE_URL ||
                 'http://localhost:8000';

// JWT 토큰: 런타임 주입(window.__ENV__) 우선, 빌드 타임(.env) fallback
const getAuthToken = (): string => {
    return (
        window.__ENV__?.JWT_TOKEN ||
        process.env.REACT_APP_JWT_TOKEN ||
        ''
    );
};

// JWT payload 디코드 — 서명 검증 X (UI 게이팅 용도). 실제 보안은 백엔드에서.
const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
};

// 현재 토큰이 admin 권한을 가지고 있고 만료되지 않았는지 확인
export const isAdminToken = (): boolean => {
    const token = getAuthToken();
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    if (payload.aud !== 'admin') return false;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return false;
    return true;
};

// 인증 헤더 구성 (Content-Type은 호출부에서 선택)
const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
    const headers: Record<string, string> = { ...extra };
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const jsonHeaders = (): Record<string, string> =>
    authHeaders({ 'Content-Type': 'application/json' });

// 공통 fetch — !ok 시 throw. errorMessage 지정 시 사용자 노출용 메시지로 대체.
// 커스텀 상태코드 분기가 필요한 곳(startChatTask, uploadFile 등)은 raw fetch 유지.
const apiFetch = async (
    path: string,
    init: RequestInit = {},
    errorMessage?: string
): Promise<Response> => {
    const response = await fetch(`${BASE_URL}${path}`, init);
    if (!response.ok) {
        throw new Error(errorMessage ?? `HTTP error! status: ${response.status}`);
    }
    return response;
};

// 새 SSE 이벤트 핸들러 인터페이스
export interface StreamHandlers {
    // snapshot: 재구독/신규 구독 시 첫 이벤트로 항상 1회 전송. 본문 버퍼를 set.
    onSnapshot?: (snapshot: TaskSnapshot) => void;
    onProgress: (stage: string, message: string) => void;
    // answer_delta: 토큰 단위 누적 텍스트 (UI에서 즉시 렌더)
    onAnswerDelta: (delta: string, iteration: number) => void;
    // answer_delta_cancel: 현재까지 누적된 스트리밍 본문 리셋 (다른 상태는 건드리지 않음)
    onAnswerCancel: () => void;
    // final: 누적 본문을 최종 권위 텍스트로 교체 (extra_info, message_id 포함)
    onFinalAnswer: (answer: string, extra_info: string, messageId: number | null) => void;
    // cancelled: 사용자가 task를 명시적으로 중단함
    onCancelled?: () => void;
    onError: (error: Error) => void;
}

// 비동기 task 큐 패턴 — POST 응답 (성공/충돌 분기)
export type StartTaskResult =
    | { ok: true; data: StartTaskResponse }
    | { ok: false; conflict: string }
    | { ok: false; atCapacity: true };

// SSE 프레임 파서 — handlers에 dispatch
const dispatchSseEvent = (
    currentEvent: string,
    eventData: any,
    handlers: StreamHandlers,
): void => {
    // 일부 이벤트는 { data: {...} } 형태로, 일부는 평탄하게 옴 → 양쪽 모두 대응
    const payload = eventData?.data ?? eventData;

    switch (currentEvent) {
        case 'snapshot': {
            handlers.onSnapshot?.({
                status: payload?.status,
                session_id: payload?.session_id,
                accumulated_answer: payload?.accumulated_answer ?? '',
                last_progress: payload?.last_progress ?? null,
                user_question: payload?.user_question ?? '',
            });
            return;
        }
        case 'answer_delta': {
            const delta = payload?.delta ?? '';
            const iteration = payload?.iteration ?? 0;
            if (typeof delta === 'string' && delta.length > 0) {
                handlers.onAnswerDelta(delta, iteration);
            }
            return;
        }
        case 'answer_delta_cancel': {
            handlers.onAnswerCancel();
            return;
        }
        case 'final': {
            const answer = payload?.answer;
            const extra_info = payload?.extra_info ?? '';
            const messageId = payload?.message_id ?? null;
            if (answer && typeof answer === 'string' && answer.trim().length > 0) {
                const trimmed = answer.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    console.warn('[Skipping] Final answer is JSON:', trimmed.substring(0, 100));
                } else {
                    handlers.onFinalAnswer(answer, extra_info, messageId);
                }
            }
            return;
        }
        case 'cancelled': {
            handlers.onCancelled?.();
            return;
        }
        case 'error': {
            const errMsg = payload?.error ?? payload?.message ?? 'unknown error';
            handlers.onError(new Error(errMsg));
            return;
        }
        case 'tool_completed':
            // 별도 처리 없음
            return;
        default: {
            // thinking / acting / tool_* / observed / fallback / progress 등
            const message = payload?.message ?? '';
            if (currentEvent && message) {
                handlers.onProgress(currentEvent, message);
            }
        }
    }
};

// 단일 SSE 응답 stream을 끝까지 파싱
const parseSseStream = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    handlers: StreamHandlers,
): Promise<void> => {
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('event:')) {
                currentEvent = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
                const dataStr = line.substring(5).trim();
                try {
                    const eventData = dataStr ? JSON.parse(dataStr) : {};
                    dispatchSseEvent(currentEvent, eventData, handlers);
                } catch {
                    console.warn('Failed to parse SSE data:', dataStr);
                }
                currentEvent = '';
            }
        }
    }
};

export const chatService = {
    // 1) 작업 시작 — task_id만 받고 즉시 반환
    //    409 Conflict는 throw 대신 { ok: false, conflict } 반환 → 호출부가 재구독 처리
    async startChatTask(request: ChatRequest): Promise<StartTaskResult> {
        const response = await fetch(`${BASE_URL}/asst/chat/stream`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(request),
        });
        if (response.status === 409) {
            const body = (await response.json()) as StartTaskConflict;
            return { ok: false, conflict: body.detail.active_task_id };
        }
        // 429 — 서버 동시 task 용량 초과. limit 수치는 노출하지 않음
        if (response.status === 429) {
            return { ok: false, atCapacity: true };
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = (await response.json()) as StartTaskResponse;
        return { ok: true, data };
    },

    // 2) 작업 결과 구독 — SSE
    //    Bearer 토큰 때문에 EventSource 사용 불가 → fetch + ReadableStream
    //    반환된 AbortController로 호출부가 unsubscribe 가능
    subscribeTask(taskId: string, handlers: StreamHandlers): AbortController {
        const controller = new AbortController();
        (async () => {
            try {
                const response = await apiFetch(
                    `/asst/chat/tasks/${taskId}/stream`,
                    { headers: authHeaders(), signal: controller.signal },
                );
                const reader = response.body?.getReader();
                if (!reader) throw new Error('Response body is null');
                await parseSseStream(reader, handlers);
            } catch (err) {
                if ((err as any).name !== 'AbortError') {
                    handlers.onError(err as Error);
                }
            }
        })();
        return controller;
    },

    // 3) 세션의 진행 중 작업 조회
    async getActiveTask(userId: string, sessionId: string): Promise<ActiveTaskResponse> {
        const response = await apiFetch(
            `/asst/users/${userId}/sessions/${sessionId}/active-task`,
            { headers: authHeaders() },
        );
        if (response.status === 204) return { task_id: null };
        return response.json();
    },

    // 4) 작업 취소 — 성공 시 SSE에서 'cancelled' 이벤트가 자연스럽게 들어옴
    async cancelTask(taskId: string): Promise<void> {
        await fetch(`${BASE_URL}/asst/chat/tasks/${taskId}/cancel`, {
            method: 'POST',
            headers: authHeaders(),
        });
    },
};

export const sessionService = {
    // 세션 생성
    async createSession(userId: string): Promise<Session> {
        const response = await fetch(`${BASE_URL}/asst/users/${userId}/sessions`, {
            method: 'POST',
            headers: authHeaders(),
        });

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage = errorData.detail;
                }
            } catch {
                // JSON 파싱 실패 시 기본 에러 메시지 사용
            }
            throw new Error(errorMessage);
        }

        return response.json();
    },

    // 세션 목록 조회
    async listSessions(userId: string): Promise<Session[]> {
        const response = await apiFetch(`/asst/users/${userId}/sessions`, {
            headers: authHeaders(),
        });
        return response.json();
    },

    // 세션 히스토리 조회
    async getSessionHistory(
        userId: string,
        sessionId: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<Message[]> {
        const params = new URLSearchParams();
        if (options.limit != null) params.set('limit', String(options.limit));
        if (options.offset != null) params.set('offset', String(options.offset));
        const qs = params.toString();
        const response = await apiFetch(
            `/asst/users/${userId}/sessions/${sessionId}${qs ? `?${qs}` : ''}`,
            { headers: authHeaders() }
        );
        return response.json();
    },

    // 세션 삭제
    async deleteSession(userId: string, sessionId: string): Promise<void> {
        await apiFetch(`/asst/users/${userId}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
    },

    // 세션 제목 수정
    async updateSessionTitle(
        userId: string,
        sessionId: string,
        title: string
    ): Promise<void> {
        const request: UpdateTitleRequest = { title };
        await apiFetch(`/asst/users/${userId}/sessions/${sessionId}/title`, {
            method: 'PATCH',
            headers: jsonHeaders(),
            body: JSON.stringify(request),
        });
    },

    // 세션의 모든 extra_info 조회
    async getAllExtraInfo(userId: string, sessionId: string): Promise<ExtraInfoMap> {
        const response = await apiFetch(
            `/asst/users/${userId}/sessions/${sessionId}/extra-info`,
            { headers: authHeaders() }
        );
        const responseData = await response.json();
        const messages = responseData.extra_info || {};

        // 백엔드 응답 구조: { "message_id": { "data": {...}, "saved_at": "..." } }
        // 프론트엔드 필요 구조: { "message_id": {...} }
        const result: ExtraInfoMap = {};
        for (const [messageId, value] of Object.entries(messages)) {
            if (value && typeof value === 'object' && 'data' in value) {
                result[messageId] = (value as any).data;
            }
        }

        return result;
    },
};

export const feedbackService = {
    // 피드백 제출
    async submitFeedback(request: FeedbackRequest): Promise<void> {
        await apiFetch(`/asst/feedback`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(request),
        });
    },
};

export const apiKeyService = {
    // API 키 저장
    async saveApiKeys(userId: string, keys: Record<string, string>): Promise<void> {
        const request: ApiKeysRequest = { keys };
        await apiFetch(`/asst/users/${userId}/apikeys`, {
            method: 'PUT',
            headers: jsonHeaders(),
            body: JSON.stringify(request),
        });
    },

    // API 키 조회
    async getApiKeys(userId: string): Promise<Record<string, string>> {
        const response = await apiFetch(`/asst/users/${userId}/apikeys`, {
            headers: authHeaders(),
        });
        return response.json();
    },
};

export const modelService = {
    async getModels(): Promise<string[]> {
        const response = await apiFetch(`/asst/models`, {
            headers: authHeaders(),
        });
        const data = await response.json();
        // API가 배열 또는 { models: [...] } 형태로 반환할 수 있음
        if (Array.isArray(data)) {
            return data;
        } else if (data && Array.isArray(data.models)) {
            return data.models;
        }
        return [];
    },
};

export const toolService = {
    // 모든 도구 상태 조회
    async getAllTools(): Promise<ToolsResponse> {
        const response = await apiFetch(`/asst/tools`, { headers: authHeaders() });
        return response.json();
    },

    // 특정 도구 활성화/비활성화
    async setToolEnabled(toolName: string, enabled: boolean): Promise<void> {
        await apiFetch(`/asst/tools/${toolName}`, {
            method: 'PATCH',
            headers: jsonHeaders(),
            body: JSON.stringify({ enabled }),
        });
    },

    // 모든 도구 활성화
    async enableAllTools(): Promise<void> {
        await apiFetch(`/asst/tools/enable-all`, {
            method: 'POST',
            headers: authHeaders(),
        });
    },

    // 모든 도구 비활성화
    async disableAllTools(): Promise<void> {
        await apiFetch(`/asst/tools/disable-all`, {
            method: 'POST',
            headers: authHeaders(),
        });
    },
};

// 파일 업로드 실패 메시지(사용자 노출용). 5xx의 detail에는 예외 객체/경로가 박혀 들어오므로 차단한다.
const uploadErrorFallback = (status: number): string => {
    if (status === 401) return '인증이 만료되었습니다. 다시 로그인해 주세요.';
    if (status === 403) return '업로드 권한이 없습니다.';
    if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    if (status >= 500) return '서버 오류로 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    return '파일 업로드에 실패했습니다.';
};

// 백엔드 4xx detail을 사용자 친화 한국어로 변환. 매칭 실패 시 일반 메시지로.
const localizeUploadDetail = (detail: string): string => {
    const unsupported = detail.match(/^Unsupported file type:\s*\.([a-zA-Z0-9]+)\./);
    if (unsupported) {
        return `지원하지 않는 파일 형식입니다 (.${unsupported[1]}).`;
    }

    const tooLarge = detail.match(/^File too large:\s*\d+\s*bytes\s*\(max\s*(\d+)MB\)/);
    if (tooLarge) return `파일 크기가 너무 큽니다. 최대 ${tooLarge[1]}MB까지 업로드할 수 있어요.`;

    const limitReached = detail.match(/^File limit reached:\s*\d+\/(\d+)/);
    if (limitReached) return `세션당 첨부 가능한 파일 수(${limitReached[1]}개)를 초과했습니다.`;

    const descTooLong = detail.match(/^Description too long\s*\(max\s*(\d+)\s*chars/);
    if (descTooLong) return `설명이 너무 깁니다. (최대 ${descTooLong[1]}자)`;

    if (detail === 'Empty file') return '빈 파일은 업로드할 수 없습니다.';
    if (detail === 'Empty filename') return '파일 이름이 비어 있습니다.';
    if (detail === 'Invalid characters in filename') return '파일 이름에 사용할 수 없는 문자가 포함되어 있습니다.';
    if (detail === 'Filename too long (max 255 bytes)') return '파일 이름이 너무 깁니다. (최대 255바이트)';
    if (detail === 'Filename has no name part') return '확장자만으로 된 파일은 업로드할 수 없습니다.';
    if (detail === 'Session not found') return '세션을 찾을 수 없습니다.';
    if (detail === 'Service initializing') return '서비스가 준비 중입니다. 잠시 후 다시 시도해 주세요.';

    // 매칭되지 않은 detail은 원문을 절대 노출하지 않고 일반 메시지로 대체
    return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
};

// 파일 업로드 서비스
// ponytail: 백엔드가 snake_case(file_id/filename/uploaded_at)로 응답한다고 가정.
// 파일 목록/삭제가 깨지면 여기 키 이름부터 실제 응답과 대조할 것.
const normalizeUploadedFile = (raw: any, fallbackName?: string): UploadedFile => ({
    file_id: raw?.file_id,
    filename: raw?.filename ?? fallbackName ?? '',
    size: raw?.size,
    description: raw?.description,
    uploaded_at: raw?.uploaded_at,
    status: raw?.status,
});

export const fileService = {
    // 파일 업로드 (multipart/form-data)
    async uploadFile(
        userId: string,
        sessionId: string,
        file: File,
        description: string = ''
    ): Promise<UploadedFile> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);

        const response = await fetch(
            `${BASE_URL}/asst/users/${userId}/sessions/${sessionId}/files`,
            {
                method: 'POST',
                // Content-Type은 브라우저가 boundary와 함께 자동 지정 → 인증 헤더만 첨부
                headers: authHeaders(),
                body: formData,
            }
        );

        if (!response.ok) {
            // 4xx의 detail은 사용자 검증 메시지(파일 크기 초과/형식 미지원 등)로 그대로 노출.
            // 5xx의 detail은 raw 예외 객체가 포함되므로 차단하고 일반 메시지로 대체.
            // 콘솔/네트워크에 추가 흔적을 남기지 않도록 console 로깅도 생략.
            let detail: unknown = undefined;
            try {
                const errorData = await response.json();
                detail = errorData?.detail;
            } catch {
                // ignore
            }
            const isSafeClientDetail =
                response.status >= 400 &&
                response.status < 500 &&
                typeof detail === 'string' &&
                detail.length > 0 &&
                detail.length <= 300;

            throw new Error(
                isSafeClientDetail
                    ? localizeUploadDetail(detail as string)
                    : uploadErrorFallback(response.status)
            );
        }

        const data = await response.json();
        return normalizeUploadedFile(data, file.name);
    },

    // 세션 파일 목록 조회
    async listFiles(userId: string, sessionId: string): Promise<UploadedFile[]> {
        const response = await apiFetch(
            `/asst/users/${userId}/sessions/${sessionId}/files`,
            { headers: authHeaders() },
            '파일 목록을 불러오지 못했습니다.'
        );
        const data = await response.json();
        const items: any[] = Array.isArray(data) ? data : data?.files ?? [];
        return items.map((it) => normalizeUploadedFile(it));
    },

    // 파일 삭제
    async deleteFile(
        userId: string,
        sessionId: string,
        fileId: string
    ): Promise<void> {
        await apiFetch(
            `/asst/users/${userId}/sessions/${sessionId}/files/${fileId}`,
            { method: 'DELETE', headers: authHeaders() },
            '파일 삭제에 실패했습니다.'
        );
    },
};

// 관리자 API
export const adminService = {
    // 전체 사용자 챗봇 이용 기록 조회
    async getLogs(query: AdminLogsQuery): Promise<AdminLogsResponse> {
        const params = new URLSearchParams();
        params.set('start_time', String(query.start_time));
        params.set('end_time', String(query.end_time));
        if (query.page != null) params.set('page', String(query.page));
        if (query.per_page != null) params.set('per_page', String(query.per_page));
        if (query.keyword) params.set('keyword', query.keyword);
        if (query.user_id) params.set('user_id', query.user_id);
        if (query.session_id) params.set('session_id', query.session_id);
        if (query.tool_name) params.set('tool_name', query.tool_name);
        if (query.process_success != null) params.set('process_success', String(query.process_success));
        if (query.sort_by) params.set('sort_by', query.sort_by);
        if (query.sort_dir) params.set('sort_dir', query.sort_dir);

        const response = await fetch(
            `${BASE_URL}/asst/admin/logs?${params.toString()}`,
            { headers: authHeaders() }
        );

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData?.detail) errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            } catch {
                // ignore
            }
            throw new Error(errorMessage);
        }

        const raw = await response.json();
        // 실제 응답: { result: true, data: { contents: [...], page, total_count, search_count } }
        const payload = raw?.data ?? raw;
        const items: any[] = Array.isArray(payload?.contents) ? payload.contents : [];

        return {
            total_count: payload?.total_count ?? items.length,
            search_count: payload?.search_count ?? payload?.total_count ?? items.length,
            page: payload?.page ?? query.page ?? 1,
            per_page: payload?.per_page ?? query.per_page ?? 20,
            items,
        };
    },

    // 사용자당 세션 상한 조회/설정 (런타임 노브, 단일워커 in-memory — 재시작 시 XML 기본값으로 리셋)
    async getMaxSessions(): Promise<number> {
        const res = await apiFetch(`/asst/admin/config/max-sessions`, { headers: authHeaders() });
        return (await res.json()).max_sessions_per_user;
    },
    async setMaxSessions(value: number): Promise<number> {
        const res = await apiFetch(`/asst/admin/config/max-sessions?value=${value}`, {
            method: 'POST',
            headers: authHeaders(),
        });
        return (await res.json()).max_sessions_per_user;
    },
};
