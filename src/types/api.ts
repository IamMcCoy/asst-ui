export interface ChatRequest {
    user_id: string;
    session_id?: string | null;
    query: string;
    thinking_mode?: boolean;
    history_mode?: boolean;
}

export interface Session {
    session_id:string
    title: string
    metadata : {created_at: string, updated_at: string, total_trimmed_turns: number},
}

export interface Message {
    message_id: number;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: string;
    feedback_type?: 'thumbs_up' | 'thumbs_down';
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

export interface ToolNamesResponse {
    tool_names: string[];
}

export interface ToolEnableRequest {
    enabled: boolean;
}

export interface ToolBulkEnableRequest {
    tools: Record<string, boolean>;
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
}

// message_id를 키로 하는 ExtraInfo 맵
export type ExtraInfoMap = Record<string, ExtraInfo>;