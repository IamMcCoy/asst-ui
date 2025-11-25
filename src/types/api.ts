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