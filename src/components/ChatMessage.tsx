import { FC, useState, MouseEvent } from 'react';
import { Tooltip, Collapse } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Message, ExtraInfo, AnalysisArtifact } from '../types/api';
import ChartVisualization from './ChartVisualization';
import { formatFileSize } from '../utils/format';
import { IconCheck, IconX, IconChevronDown, IconDownload, IconFile } from './icons';
import './ChatMessage.css';

interface ChatMessageProps {
    message: Message;
    onFeedback: (messageId: number, feedbackType: 'thumbs_up' | 'thumbs_down') => void;
    /** true면 액션/피드백 영역과 차트 시각화 숨김 (스트리밍 중 메시지에 사용) */
    streaming?: boolean;
    extraInfo?: ExtraInfo;
    userInitial?: string;
    // 답변 속 매뉴얼 PDF 링크(…/x.pdf#page=N) 클릭 → 새 창 대신 우측 아티팩트 패널에서 열기
    onOpenDocument?: (href: string) => void;
    // 분석 결과 파일 → 우측 아티팩트 패널에서 열기
    onOpenArtifact?: (artifact: AnalysisArtifact) => void;
}

const isPdfLink = (href: string) => /\.pdf(#page=\d+)?$/i.test(href);

// IP/Payload 분석 전체 결과 파일 — 패널에서 열기 + 다운로드. expires_at 경과 시 만료 표시.
// artifacts 엔드포인트는 인증 없이 브라우저가 직접 여는 설계(파일명의 128비트 난수가 접근 통제)이고
// host가 API_BASE_URL과 다를 수 있으므로 다운로드는 download_url을 그대로 연다.
const ArtifactCard: FC<{ artifact: AnalysisArtifact; onOpen?: (a: AnalysisArtifact) => void }> = ({ artifact, onOpen }) => {
    const expired = !!artifact.expires_at && new Date(artifact.expires_at).getTime() < Date.now();
    const meta = [
        artifact.tool === 'analyze_ip' ? 'IP 분석 전체 결과' : 'Payload 분석 전체 결과',
        artifact.bytes != null ? formatFileSize(artifact.bytes) : null,
        expired ? '만료됨' : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className={'msg-artifact' + (expired ? ' expired' : '')}>
            <IconFile className="ic-sm" />
            {onOpen && !expired ? (
                <button type="button" className="msg-artifact-info msg-artifact-open" onClick={() => onOpen(artifact)} title="패널에서 열기">
                    <span className="msg-artifact-name">{artifact.filename}</span>
                    <span className="msg-artifact-meta">{meta}</span>
                </button>
            ) : (
                <div className="msg-artifact-info">
                    <span className="msg-artifact-name" title={artifact.filename}>{artifact.filename}</span>
                    <span className="msg-artifact-meta">{meta}</span>
                </div>
            )}
            {expired ? (
                <button type="button" className="msg-artifact-btn" disabled title="다운로드 기한이 지났습니다">
                    <IconDownload className="ic-sm" />
                </button>
            ) : (
                <a
                    className="msg-artifact-btn"
                    href={artifact.download_url}
                    download={artifact.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="다운로드"
                    aria-label="다운로드"
                >
                    <IconDownload className="ic-sm" />
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

// 메타 컬럼: "15:03" (오늘) / "09.10 15:03" (그 외)
const formatTime = (iso?: string): string => {
    if (!iso) return '';
    // 백엔드는 "2026-09-10 14:36:07"(공백) 형식 — Safari는 ISO(T)만 파싱하므로 치환
    const date = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(iso) ? iso.replace(' ', 'T') : iso);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    return sameDay ? hm : `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${hm}`;
};

// 시안의 Conversation 행 — 120px 모노 메타 컬럼 + 본문 (질문은 큰 제목체, 응답은 편집 본문체)
export const ChatMessage: FC<ChatMessageProps> = ({
    message,
    onFeedback,
    streaming = false,
    extraInfo,
    onOpenDocument,
    onOpenArtifact,
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

    // 마크다운 링크 오버라이드 — PDF 링크만 패널로, 나머지는 기본 동작
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

    const time = formatTime(message.timestamp);
    const side = (label: string) => (time ? `${time} · ${label}` : label);

    if (isUser) {
        return (
            <div className="msg user">
                <div className="msg-side">{side('질문')}</div>
                <div className="msg-question">{message.content}</div>
            </div>
        );
    }

    return (
        <article className="msg bot">
            <div className="msg-side">
                <span>{side('응답')}</span>
                {message.model && <span className="msg-side-model">{message.model}</span>}
            </div>

            <div className="msg-body">
                {message.truncated && (
                    <div className="msg-truncated-badge">
                        <IconX className="ic-sm" />
                        응답이 잘렸어요 — 토큰 한도에 도달해 일부만 생성되었습니다
                    </div>
                )}

                {thinking && (
                    <>
                        <button type="button" className="msg-thinking-toggle mono-label" onClick={() => setShowThinking((v) => !v)}>
                            사고 과정 {showThinking ? '숨기기' : '보기'}
                            <IconChevronDown
                                className="ic-sm"
                                style={{ transform: showThinking ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms' }}
                            />
                        </button>
                        <Collapse in={showThinking}>
                            <div className="msg-thinking-block">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight, rehypeRaw]}>
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

                {!streaming && extraInfo?.seql && extraInfo.seql.length > 0 && (
                    <details className="msg-seql">
                        <summary className="mono-label">생성된 SeQL 쿼리 · {extraInfo.seql.length}</summary>
                        {extraInfo.seql.map((q, i) => (
                            <pre key={i}><code className="language-sql">{q}</code></pre>
                        ))}
                    </details>
                )}

                {!streaming && extraInfo?.artifacts && extraInfo.artifacts.length > 0 && (
                    <div className="msg-artifacts">
                        <div className="mono-label">분석 결과 파일 · {extraInfo.artifacts.length}</div>
                        {extraInfo.artifacts.map((a) => (
                            <ArtifactCard key={a.download_url} artifact={a} onOpen={onOpenArtifact} />
                        ))}
                    </div>
                )}

                {!streaming && extraInfo && extraInfo.viz_type && extraInfo.viz_type !== 'none' && extraInfo.query_result && (
                    <div className="msg-chart">
                        <ChartVisualization
                            viz_type={extraInfo.viz_type}
                            chart_config={extraInfo.chart_config}
                            query_result={extraInfo.query_result}
                        />
                    </div>
                )}

                {!streaming && (
                    <div className={'msg-actions' + (localFeedback ? ' is-active' : '')}>
                        <Tooltip title="도움이 되었습니다" arrow>
                            <button
                                type="button"
                                className={'msg-action-btn' + (localFeedback === 'thumbs_up' ? ' on-up' : '')}
                                onClick={() => handleFeedback('thumbs_up')}
                                aria-label="좋아요"
                            >
                                <IconCheck className="ic-sm" /> 도움됨
                            </button>
                        </Tooltip>
                        <Tooltip title="도움이 되지 않았습니다" arrow>
                            <button
                                type="button"
                                className={'msg-action-btn' + (localFeedback === 'thumbs_down' ? ' on-down' : '')}
                                onClick={() => handleFeedback('thumbs_down')}
                                aria-label="아쉬워요"
                            >
                                <IconX className="ic-sm" /> 아쉬움
                            </button>
                        </Tooltip>
                    </div>
                )}
            </div>
        </article>
    );
};
