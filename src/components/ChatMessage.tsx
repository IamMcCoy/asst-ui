import { FC, useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Tooltip,
    Avatar,
    Fade,
    Collapse,
    Button,
} from '@mui/material';
import {
    ThumbUp as ThumbUpIcon,
    ThumbDown as ThumbDownIcon,
    Person as PersonIcon,
    SmartToy as BotIcon,
    ExpandMore as ExpandMoreIcon,
    Psychology as ThinkingIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';
import { Message, ExtraInfo } from '../types/api';
import { useTypingEffect } from '../hooks/useTypingEffect';
import ChartVisualization from './ChartVisualization';

interface ChatMessageProps {
    message: Message;
    onFeedback: (messageId: number, feedbackType: 'thumbs_up' | 'thumbs_down') => void;
    isTyping?: boolean;
    onTypingComplete?: () => void;
    extraInfo?: ExtraInfo;
}

// 메시지에서 <think> 블록을 파싱하는 함수
const parseThinkingBlock = (content: string): { thinking: string | null; response: string } => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/;
    const match = content.match(thinkRegex);

    if (match) {
        const thinking = match[1].trim();
        const response = content.replace(thinkRegex, '').trim();
        return { thinking, response };
    }

    return { thinking: null, response: content };
};

export const ChatMessage: FC<ChatMessageProps> = ({ message, onFeedback, isTyping = false, onTypingComplete, extraInfo }) => {
    const [localFeedback, setLocalFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(
        message.feedback_type || null
    );
    const [isHovered, setIsHovered] = useState(false);
    const [showThinking, setShowThinking] = useState(false);

    // 원본 메시지에서 thinking과 response 분리
    const originalParsed = parseThinkingBlock(message.content);

    // 타이핑은 response 부분에만 적용
    const { displayedText, isComplete } = useTypingEffect(originalParsed.response, isTyping);

    // 타이핑 완료 시 콜백 호출
    useEffect(() => {
        if (isTyping && isComplete && onTypingComplete) {
            onTypingComplete();
        }
    }, [isComplete, isTyping, onTypingComplete]);

    const handleFeedback = (feedbackType: 'thumbs_up' | 'thumbs_down') => {
        setLocalFeedback(feedbackType);
        onFeedback(message.message_id, feedbackType);
    };

    const isUser = message.role === 'user';

    // thinking은 원본 그대로 사용, response는 타이핑 효과 적용
    const thinking = originalParsed.thinking;
    const response = isTyping ? displayedText : originalParsed.response;

    return (
        <Fade in timeout={500}>
            <Box
                display="flex"
                justifyContent={isUser ? 'flex-end' : 'flex-start'}
                mb={3}
                pl={isUser ? 0 : 0}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Box
                    display="flex"
                    gap={2}
                    maxWidth="70%"
                    sx={{ flexDirection: isUser ? 'row-reverse' : 'row' }}
                >
                    <Avatar
                        sx={{
                            bgcolor: isUser ? 'secondary.main' : 'primary.main',
                            width: 40,
                            height: 40,
                            boxShadow: isUser
                                ? '0 4px 14px 0 rgba(236, 72, 153, 0.4)'
                                : '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
                        }}
                    >
                        {isUser ? <PersonIcon /> : <BotIcon />}
                    </Avatar>

                    <Box flex={1}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2.5,
                                background: isUser
                                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(219, 39, 119, 0.1) 100%)'
                                    : 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid',
                                borderColor: isUser
                                    ? 'rgba(236, 72, 153, 0.2)'
                                    : 'rgba(99, 102, 241, 0.2)',
                                borderRadius: '16px',
                                transition: 'all 0.3s ease',
                                transform: isHovered ? 'translateY(-2px)' : 'none',
                                boxShadow: isHovered
                                    ? isUser
                                        ? '0 8px 24px rgba(236, 72, 153, 0.2)'
                                        : '0 8px 24px rgba(99, 102, 241, 0.2)'
                                    : 'none',
                            }}
                        >
                            {/* Thinking 블록 (접을 수 있음) */}
                            {thinking && !isUser && (
                                <Box mb={2}>
                                    <Button
                                        onClick={() => setShowThinking(!showThinking)}
                                        startIcon={<ThinkingIcon />}
                                        endIcon={
                                            <ExpandMoreIcon
                                                sx={{
                                                    transform: showThinking ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.3s ease',
                                                }}
                                            />
                                        }
                                        size="small"
                                        sx={{
                                            color: 'text.secondary',
                                            textTransform: 'none',
                                            fontSize: '0.85rem',
                                            '&:hover': {
                                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                color: 'primary.main',
                                            },
                                        }}
                                    >
                                        사고 과정 {showThinking ? '숨기기' : '보기'}
                                    </Button>
                                    <Collapse in={showThinking}>
                                        <Box
                                            mt={1.5}
                                            p={2}
                                            sx={{
                                                background: 'rgba(99, 102, 241, 0.05)',
                                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                                borderRadius: '12px',
                                                '& p': {
                                                    margin: '0 0 0.8em 0',
                                                    lineHeight: 1.6,
                                                    fontSize: '0.9rem',
                                                    color: 'text.secondary',
                                                    '&:last-child': {
                                                        marginBottom: 0,
                                                    },
                                                },
                                            }}
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                            >
                                                {thinking}
                                            </ReactMarkdown>
                                        </Box>
                                    </Collapse>
                                </Box>
                            )}

                            {/* 일반 응답 */}
                            <Box
                                sx={{
                                    '& p': {
                                        margin: '0 0 1em 0',
                                        lineHeight: 1.7,
                                        fontSize: '0.95rem',
                                        '&:last-child': {
                                            marginBottom: 0,
                                        },
                                    },
                                    '& pre': {
                                        margin: '1em 0',
                                        padding: '1em',
                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '8px',
                                        overflow: 'auto',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                    },
                                    '& code': {
                                        fontFamily: 'monospace',
                                        fontSize: '0.9em',
                                    },
                                    '& pre code': {
                                        backgroundColor: 'transparent',
                                        padding: 0,
                                        border: 'none',
                                    },
                                    '& code:not(pre code)': {
                                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                        padding: '0.2em 0.4em',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                    },
                                    '& ul, & ol': {
                                        marginLeft: '1.5em',
                                        marginBottom: '1em',
                                    },
                                    '& li': {
                                        marginBottom: '0.5em',
                                    },
                                    '& table': {
                                        borderCollapse: 'collapse',
                                        width: '100%',
                                        marginBottom: '1em',
                                    },
                                    '& th, & td': {
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                        padding: '0.5em',
                                        textAlign: 'left',
                                    },
                                    '& th': {
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        fontWeight: 600,
                                    },
                                    '& blockquote': {
                                        borderLeft: '4px solid rgba(99, 102, 241, 0.5)',
                                        paddingLeft: '1em',
                                        marginLeft: 0,
                                        fontStyle: 'italic',
                                        color: 'text.secondary',
                                    },
                                    '& h1, & h2, & h3, & h4, & h5, & h6': {
                                        marginTop: '1em',
                                        marginBottom: '0.5em',
                                        fontWeight: 600,
                                    },
                                    '& h1': { fontSize: '1.5em' },
                                    '& h2': { fontSize: '1.3em' },
                                    '& h3': { fontSize: '1.1em' },
                                    '& a': {
                                        color: 'primary.main',
                                        textDecoration: 'none',
                                        '&:hover': {
                                            textDecoration: 'underline',
                                        },
                                    },
                                }}
                            >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                    >
                                        {response}
                                    </ReactMarkdown>
                            </Box>
                            <Typography
                                variant="caption"
                                display="block"
                                mt={1.5}
                                sx={{
                                    color: 'text.secondary',
                                    fontSize: '0.75rem',
                                }}
                            >
                                {(() => {
                                    try {
                                        const date = new Date(message.timestamp);
                                        if (isNaN(date.getTime())) {
                                            return '';
                                        }
                                        return date.toLocaleString('ko-KR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        });
                                    } catch {
                                        return '';
                                    }
                                })()}
                            </Typography>
                        </Paper>

                        {/* 시각화 차트 표시 */}
                        {!isUser && !isTyping && extraInfo && extraInfo.viz_type && extraInfo.viz_type !== 'none' && extraInfo.query_result && (
                            <Fade in timeout={500}>
                                <Box mt={2} maxWidth="100%">
                                    <ChartVisualization
                                        viz_type={extraInfo.viz_type}
                                        chart_config={extraInfo.chart_config}
                                        query_result={extraInfo.query_result}
                                    />
                                </Box>
                            </Fade>
                        )}

                        {!isUser && !isTyping && (
                            <Box display="flex" gap={1} mt={1} ml={1}>
                                <Tooltip title="도움이 되었습니다" arrow>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleFeedback('thumbs_up')}
                                        sx={{
                                            color:
                                                localFeedback === 'thumbs_up'
                                                    ? 'primary.main'
                                                    : 'text.secondary',
                                            '&:hover': {
                                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                color: 'primary.main',
                                            },
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <ThumbUpIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="도움이 되지 않았습니다" arrow>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleFeedback('thumbs_down')}
                                        sx={{
                                            color:
                                                localFeedback === 'thumbs_down'
                                                    ? 'error.main'
                                                    : 'text.secondary',
                                            '&:hover': {
                                                bgcolor: 'rgba(239, 68, 68, 0.1)',
                                                color: 'error.main',
                                            },
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <ThumbDownIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Fade>
    );
};