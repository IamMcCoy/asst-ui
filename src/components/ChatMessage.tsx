import { FC, useState } from 'react';
import { Tooltip, Fade, Collapse } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Message, ExtraInfo } from '../types/api';
import ChartVisualization from './ChartVisualization';
import { IconSparkle, IconCheck, IconX, IconChevronDown } from './icons';
import './ChatMessage.css';

interface ChatMessageProps {
    message: Message;
    onFeedback: (messageId: number, feedbackType: 'thumbs_up' | 'thumbs_down') => void;
    /** true면 액션/피드백 영역과 차트 시각화 숨김 (스트리밍 중 메시지에 사용) */
    streaming?: boolean;
    extraInfo?: ExtraInfo;
    userInitial?: string;
}

// 메시지에서 <think> 블록을 파싱
const parseThinkingBlock = (content: string): { thinking: string | null; response: string } => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/;
    const match = content.match(thinkRegex);
    if (match) {
        return { thinking: match[1].trim(), response: content.replace(thinkRegex, '').trim() };
    }
    return { thinking: null, response: content };
};

// 메시지 메타: 년월일 + 시:분 — "2026.05.18 14:23"
const formatTimestamp = (iso: string): string => {
    try {
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';
        const y = date.getFullYear();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${y}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
        return '';
    }
};

export const ChatMessage: FC<ChatMessageProps> = ({
    message,
    onFeedback,
    streaming = false,
    extraInfo,
    userInitial = 'U',
}) => {
    const [localFeedback, setLocalFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(
        message.feedback_type || null
    );
    const [showThinking, setShowThinking] = useState(false);

    const isUser = message.role === 'user';
    const { thinking, response } = parseThinkingBlock(message.content);

    const handleFeedback = (type: 'thumbs_up' | 'thumbs_down') => {
        setLocalFeedback(type);
        onFeedback(message.message_id, type);
    };

    return (
        <Fade in timeout={300}>
            <div className={'msg ' + (isUser ? 'user' : 'bot')}>
                {isUser ? (
                    <div className="msg-avatar user">{userInitial}</div>
                ) : (
                    <div className="msg-avatar bot">
                        <IconSparkle />
                    </div>
                )}

                <div className="msg-body">
                    <div className="msg-meta">
                        <span className="ts">{formatTimestamp(message.timestamp)}</span>
                        {!isUser && message.model && (
                            <>
                                <span className="dot" aria-hidden>·</span>
                                <span className="model">{message.model}</span>
                            </>
                        )}
                    </div>

                    <div className="msg-bubble">
                        {thinking && !isUser && (
                            <>
                                <button
                                    type="button"
                                    className="msg-thinking-toggle"
                                    onClick={() => setShowThinking((v) => !v)}
                                >
                                    사고 과정 {showThinking ? '숨기기' : '보기'}
                                    <IconChevronDown
                                        className="ic-sm"
                                        style={{
                                            transform: showThinking ? 'rotate(180deg)' : 'rotate(0)',
                                            transition: 'transform 200ms',
                                        }}
                                    />
                                </button>
                                <Collapse in={showThinking}>
                                    <div className="msg-thinking-block">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                        >
                                            {thinking}
                                        </ReactMarkdown>
                                    </div>
                                </Collapse>
                            </>
                        )}

                        <div className="msg-content">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                            >
                                {response}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {!isUser && !streaming && extraInfo && extraInfo.viz_type && extraInfo.viz_type !== 'none' && extraInfo.query_result && (
                        <div style={{ marginTop: 10, maxWidth: '100%' }}>
                            <ChartVisualization
                                viz_type={extraInfo.viz_type}
                                chart_config={extraInfo.chart_config}
                                query_result={extraInfo.query_result}
                            />
                        </div>
                    )}

                    {!isUser && !streaming && (
                        <div className={'msg-actions' + (localFeedback ? ' is-active' : '')}>
                            <Tooltip title="도움이 되었습니다" arrow>
                                <button
                                    type="button"
                                    className={
                                        'msg-action-btn' + (localFeedback === 'thumbs_up' ? ' on-up' : '')
                                    }
                                    onClick={() => handleFeedback('thumbs_up')}
                                    aria-label="좋아요"
                                >
                                    <IconCheck className="ic-sm" />
                                </button>
                            </Tooltip>
                            <Tooltip title="도움이 되지 않았습니다" arrow>
                                <button
                                    type="button"
                                    className={
                                        'msg-action-btn' + (localFeedback === 'thumbs_down' ? ' on-down' : '')
                                    }
                                    onClick={() => handleFeedback('thumbs_down')}
                                    aria-label="아쉬워요"
                                >
                                    <IconX className="ic-sm" />
                                </button>
                            </Tooltip>
                        </div>
                    )}
                </div>
            </div>
        </Fade>
    );
};
