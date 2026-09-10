export interface ChatRequest {
    user_id: string;
    session_id?: string | null;
    query: string;
    model?: string | null;
    thinking_mode?: boolean;
    reasoning_effort?: string | null;  // 'low' | 'medium' | 'high'
    history_mode: boolean;
    file_ids?: string[] | null;
}

// 파일 업로드 관련 타입
export interface UploadedFile {
    file_id: string;
    filename: string;
    size?: number;
    description?: string;
    uploaded_at?: string;
    status?: string;
}

// 관리자 로그 조회 관련 타입 (백엔드 응답 키 기준)
export interface AdminLogItem {
    message_id?: number;
    user_id: string;
    session_id: string;
    question?: string;
    response?: string;
    tool_name?: string | null;
    process_success?: 0 | 1;
    question_dt?: string | number;
    response_dt?: string | number;
    latency?: number;
    error_message?: string | null;
    [key: string]: unknown;
}

export interface AdminLogsResponse {
    total_count: number;
    search_count: number;
    page: number;
    per_page: number;
    items: AdminLogItem[];
}

export interface AdminLogsQuery {
    start_time: number;  // epoch ms
    end_time: number;    // epoch ms
    page?: number;
    per_page?: number;
    keyword?: string | null;
    user_id?: string | null;
    session_id?: string | null;
    tool_name?: string | null;
    process_success?: 0 | 1 | null;
    sort_by?: string;
    sort_dir?: 'ASC' | 'DESC';
}

export interface Session {
    session_id:string
    title: string
    metadata : {created_at: string, updated_at: string, total_trimmed_turns: number},
    active_task_id?: string | null;
}

// 비동기 task 큐 패턴: POST /asst/chat/stream 200 응답
export interface StartTaskResponse {
    task_id: string;
    session_id: string;
    status: 'running';
}

// 409 Conflict 응답 (동일 세션 동시 작업 충돌)
export interface StartTaskConflict {
    detail: {
        active_task_id: string;
        message: string;
    };
}

// GET .../active-task 응답
export interface ActiveTaskResponse {
    task_id: string | null;
    status?: 'running';
    started_at?: string;
}

// SSE snapshot 이벤트 페이로드
export interface TaskSnapshot {
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    session_id: string;
    accumulated_answer: string;
    last_progress: { stage: string; message: string } | null;
    // 현재 task가 처리 중인 사용자 질문 원문. 새로고침 직후 DB에 아직 저장되지 않은
    // 질문도 복원할 수 있도록 백엔드가 snapshot에 포함시켜 보냄.
    user_question: string;
}

export interface Message {
    message_id: number;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: string;
    feedback_type?: 'thumbs_up' | 'thumbs_down';
    model?: string | null;
    // fallback(stage=length) 이후 저장된 부분 답변 — "응답이 잘렸어요" 배지 표시용
    truncated?: boolean;
}

export interface FeedbackRequest {
    message_id: number;
    feedback_type: 'thumbs_up' | 'thumbs_down';
    comment?: string;
}

export interface UpdateTitleRequest {
    title: string;
}

export interface ApiKeysRequest {
    keys: Record<string, string>;
}

// Tool 관련 타입
export interface Tool {
    enabled: boolean;
    description: string;
}

export interface ToolsResponse {
    tools: Record<string, Tool>;
}

// Extra Info (시각화 정보) 관련 타입
export interface ExtraInfo {
    viz_type?: 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'none';
    chart_config?: {
        x_axis: string;
        y_axis: string;
        x_label?: string;
        y_label?: string;
    };
    query_result?: Record<string, string | number>[];
    // text2seql이 검증 통과한 SeQL 쿼리 (extra_info의 "text2seql:<call_id>" 키에서 수집)
    seql?: string[];
    // IP/Payload 분석 전체 결과 파일 ("analyze_ip:" / "analyze_weblog:" 키에서 수집)
    artifacts?: AnalysisArtifact[];
}

export interface AnalysisArtifact {
    tool: 'analyze_ip' | 'analyze_weblog';
    filename: string;
    bytes?: number;
    expires_at?: string;
    download_url: string;
}

// message_id를 키로 하는 ExtraInfo 맵
export type ExtraInfoMap = Record<string, ExtraInfo>;