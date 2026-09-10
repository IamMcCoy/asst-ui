import { FC, useState, MouseEvent } from 'react';
import { Tooltip, Fade, Collapse } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Message, ExtraInfo, AnalysisArtifact } from '../types/api';
import ChartVisualization from './ChartVisualization';
import { formatFileSize } from '../utils/format';
import { IconSparkle, IconCheck, IconX, IconChevronDown, IconDownload, IconFile } from './icons';
import './ChatMessage.css';

interface ChatMessageProps {
    message: Message;
    onFeedback: (messageId: number, feedbackType: 'thumbs_up' | 'thumbs_down') => void;
    /** true면 액션/피드백 영역과 차트 시각화 숨김 (스트리밍 중 메시지에 사용) */
    streaming?: boolean;
    extraInfo?: ExtraInfo;
    userInitial?: string;
    // 답변 속 매뉴얼 PDF 링크(…/x.pdf#page=N) 클릭 → 새 창 대신 우측 문서 패널에서 열기
    onOpenDocument?: (href: string) => void;
}

const isPdfLink = (href: string) => /\.pdf(#page=\d+)?$/i.test(href);

// IP/Payload 분석 전체 결과 파일 카드 — expires_at 경과 시 만료 표시.
// artifacts 엔드포인트는 인증 없이 브라우저가 직접 여는 설계(파일명의 128비트 난수가 접근 통제)이고
// host가 API_BASE_URL과 다를 수 있으므로 fetch 대신 download_url을 그대로 연다.
// 서버가 Content-Disposition: attachment로 응답해 새 탭은 저장 후 닫힌다.
const ArtifactCard: FC<{ artifact: AnalysisArtifact }> = ({ artifact }) => {
    const expired = !!artifact.expires_at && new Date(artifact.expires_at).getTime() < Date.now();

    return (
        <div className={'msg-artifact' + (expired ? ' expired' : '')}>
            <IconFile className="ic-sm" />
            <div className="msg-artifact-info">
                <span className="msg-artifact-name" title={artifact.filename}>{artifact.filename}</span>
                <span className="msg-artifact-meta">
                    {artifact.tool === 'analyze_ip' ? 'IP 분석 전체 결과' : 'Payload 분석 전체 결과'}
                    {artifact.bytes != null && ` · ${formatFileSize(artifact.bytes)}`}
                    {expired && ' · 만료됨'}
                </span>
            </div>
            {expired ? (
                <button type="button" className="msg-artifact-btn" disabled title="다운로드 기한이 지났습니다">
                    <IconDownload className="ic-sm" />
                    다운로드
                </button>
            ) : (
                <a
                    className="msg-artifact-btn"
                    href={artifact.download_url}
                    download={artifact.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="다운로드"
                >
                    <IconDownload className="ic-sm" />
                    다운로드
                </a>
            )}
        </div>
    );
};

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
    onOpenDocument,
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

    // 마크다운 링크 오버라이드 — PDF 링크만 문서 패널로, 나머지는 기본 동작
    const markdownComponents = {
        a: ({ href, children, node: _node, ...rest }: any) => {
            const openInPanel = !!onOpenDocument && typeof href === 'string' && isPdfLink(href);
            const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
                if (!openInPanel) return;
                e.preventDefault();
                onOpenDocument!(href);
            };
            return (
                <a
                    href={href}
                    {...rest}
                    onClick={handleClick}
                    target={openInPanel ? undefined : '_blank'}
                    rel={openInPanel ? undefined : 'noopener noreferrer'}
                >
                    {children}
                </a>
            );
        },
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
                        {message.truncated && !isUser && (
                            <div className="msg-truncated-badge">
                                <IconX className="ic-sm" />
                                응답이 잘렸어요 — 토큰 한도에 도달해 일부만 생성되었습니다
                            </div>
                        )}
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
                                components={markdownComponents}
                            >
                                {response}
                            </ReactMarkdown>
                        </div>

                        {!isUser && !streaming && extraInfo?.seql && extraInfo.seql.length > 0 && (
                            <details className="msg-seql">
                                <summary>생성된 SeQL 쿼리 ({extraInfo.seql.length})</summary>
                                {extraInfo.seql.map((q, i) => (
                                    <pre key={i}><code className="language-sql">{q}</code></pre>
                                ))}
                            </details>
                        )}
                    </div>

                    {!isUser && !streaming && extraInfo?.artifacts?.map((a) => (
                        <ArtifactCard key={a.download_url} artifact={a} />
                    ))}

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
