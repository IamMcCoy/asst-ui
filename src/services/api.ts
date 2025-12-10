import {
    ChatRequest,
    Session,
    Message,
    FeedbackRequest,
    UpdateTitleRequest,
    ApiKeysRequest,
    ToolsResponse,
    ToolBulkEnableRequest,
    ExtraInfoMap,
} from '../types/api';

// 런타임 환경 변수 사용 (window.__ENV__)
// 개발 환경에서는 process.env 사용
const BASE_URL = window.__ENV__?.API_BASE_URL ||
                 process.env.REACT_APP_API_BASE_URL ||
                 'http://localhost:8000';

interface StreamEvent {
    event: string;
    data: {
        stage: string;
        message: string;
        data: {
            answer?: string;
            extra_info?: string;
        };
    };
}

export const chatService = {
    // 스트리밍 채팅
    async streamChat(
        request: ChatRequest,
        onProgress: (stage: string, message: string) => void,
        onFinalAnswer: (answer: string, extra_info: string, messageId: number | null) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        try {
            const response = await fetch(`${BASE_URL}/ast/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Response body is null');
            }

            let buffer = '';
            let currentEvent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Keep the last incomplete line in buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        currentEvent = line.substring(6).trim();
                    } else if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();

                        try {
                            const eventData = JSON.parse(dataStr) as StreamEvent['data'];

                            console.log('[SSE Event]', currentEvent, eventData);

                            // Skip tool_completed event entirely
                            if (currentEvent === 'tool_completed') {
                                console.log('[Skipping] tool_completed event');
                                currentEvent = '';
                                continue;
                            }

                            // Process final event ONLY if it has an answer field
                            if (currentEvent === 'final') {
                                const answer = eventData.data?.answer;
                                const extra_info = eventData.data?.extra_info ?? "";
                                const messageId = (eventData.data as any)?.message_id ?? null;

                                // Check if answer exists and is a non-empty string
                                if (answer && typeof answer === 'string' && answer.trim().length > 0) {
                                    // Additional check: answer should not be a JSON object
                                    const trimmedAnswer = answer.trim();
                                    if (trimmedAnswer.startsWith('{') || trimmedAnswer.startsWith('[')) {
                                        console.warn('[Skipping] Final event contains JSON data instead of markdown:', trimmedAnswer.substring(0, 100));
                                    } else {
                                        // Final answer exists and is valid markdown text
                                        console.log('[Final] Valid answer received, message_id:', messageId);
                                        onFinalAnswer(answer, extra_info, messageId);
                                    }
                                } else {
                                    console.log('[Skipping] Final event without valid answer field');
                                }
                                // Skip final event regardless (with or without answer)
                                currentEvent = '';
                                continue;
                            }

                            // Progress updates for other events
                            if (currentEvent && eventData.message) {
                                onProgress(currentEvent, eventData.message);
                            }
                        } catch (e) {
                            // Ignore JSON parse errors for malformed data
                            console.warn('Failed to parse SSE data:', dataStr);
                        }

                        currentEvent = '';
                    }
                }
            }
        } catch (error) {
            onError(error as Error);
        }
    },
};

export const sessionService = {
    // 세션 생성
    async createSession(userId: string): Promise<Session> {
        const response = await fetch(`${BASE_URL}/ast/users/${userId}/sessions`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    },

    // 세션 목록 조회
    async listSessions(userId: string): Promise<Session[]> {
        const response = await fetch(`${BASE_URL}/ast/users/${userId}/sessions`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    },

    // 세션 히스토리 조회
    async getSessionHistory(userId: string, sessionId: string): Promise<Message[]> {
        const response = await fetch(
            `${BASE_URL}/ast/users/${userId}/sessions/${sessionId}`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    },

    // 세션 삭제
    async deleteSession(userId: string, sessionId: string): Promise<void> {
        const response = await fetch(
            `${BASE_URL}/ast/users/${userId}/sessions/${sessionId}`,
            {
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },

    // 세션 제목 수정
    async updateSessionTitle(
        userId: string,
        sessionId: string,
        title: string
    ): Promise<void> {
        const request: UpdateTitleRequest = { title };
        const response = await fetch(
            `${BASE_URL}/ast/users/${userId}/sessions/${sessionId}/title`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },

    // 세션의 모든 extra_info 조회
    async getAllExtraInfo(userId: string, sessionId: string): Promise<ExtraInfoMap> {
        const response = await fetch(
            `${BASE_URL}/ast/users/${userId}/sessions/${sessionId}/extra-info`
        );

        if (!response.ok) {
            if (response.status === 404) {
                return {}; // extra_info가 없으면 빈 객체 반환
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

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
        const response = await fetch(`${BASE_URL}/ast/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },
};

export const apiKeyService = {
    // API 키 저장
    async saveApiKeys(userId: string, keys: Record<string, string>): Promise<void> {
        const request: ApiKeysRequest = { keys };
        const response = await fetch(`${BASE_URL}/ast/users/${userId}/apikeys`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },

    // API 키 조회
    async getApiKeys(userId: string): Promise<Record<string, string>> {
        const response = await fetch(`${BASE_URL}/ast/users/${userId}/apikeys`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    },
};

export const toolService = {
    // 모든 도구 상태 조회
    async getAllTools(): Promise<ToolsResponse> {
        const response = await fetch(`${BASE_URL}/ast/tools`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    },

    // 특정 도구 활성화/비활성화
    async setToolEnabled(toolName: string, enabled: boolean): Promise<void> {
        const response = await fetch(`${BASE_URL}/ast/tools/${toolName}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enabled }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },

    // 여러 도구 일괄 활성화/비활성화
    async setToolsBulk(tools: Record<string, boolean>): Promise<void> {
        const request: ToolBulkEnableRequest = { tools };
        const response = await fetch(`${BASE_URL}/ast/tools`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },

    // 모든 도구 활성화
    async enableAllTools(): Promise<void> {
        const response = await fetch(`${BASE_URL}/ast/tools/enable-all`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },

    // 모든 도구 비활성화
    async disableAllTools(): Promise<void> {
        const response = await fetch(`${BASE_URL}/ast/tools/disable-all`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    },
};