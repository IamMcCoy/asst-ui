import { FC, useState, useEffect, useRef } from 'react';
import {
    Box,
    CircularProgress,
    Typography,
    Alert, Avatar, Stack,
} from '@mui/material';
import { SessionSidebar } from './SessionSidebar';
import { ChatMessage } from './ChatMessage';
import { MessageInput } from './MessageInput';
import { ProgressIndicator } from './ProgressIndicator';
import { Session, Message, ChatRequest, ExtraInfoMap, ExtraInfo } from '../types/api';
import { chatService, sessionService, feedbackService } from '../services/api';
import {SmartToy as BotIcon} from "@mui/icons-material";

interface ChatbotProps {
    userId: string;
}

export const Chatbot: FC<ChatbotProps> = ({ userId }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [extraInfoMap, setExtraInfoMap] = useState<ExtraInfoMap>({});
    const [pendingExtraInfo, setPendingExtraInfo] = useState<ExtraInfo | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [progressStage, setProgressStage] = useState<string>('');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [assistantMessageId, setAssistantMessageId] = useState<number | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [scrollTimer, setScrollTimer] = useState<NodeJS.Timeout | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);

    // 세션 목록 로드
    useEffect(() => {
        loadSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // 현재 세션의 메시지 로드
    useEffect(() => {
        if (currentSessionId) {
            loadMessages(currentSessionId);
        } else {
            setMessages([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSessionId]);

    // 자동 스크롤
    useEffect(() => {
        if (autoScroll) {
            scrollToBottom();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, streamingMessage, progressStage]);

    // 타이핑 중 자동 스크롤
    useEffect(() => {
        if (autoScroll && isTyping) {
            const timer = setInterval(() => {
                scrollToBottom();
            }, 100);
            setScrollTimer(timer);
        } else {
            if (scrollTimer) {
                clearInterval(scrollTimer);
                setScrollTimer(null);
            }
        }

        return () => {
            if (scrollTimer) {
                clearInterval(scrollTimer);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTyping, autoScroll]);

    // 사용자 스크롤 감지
    const handleScroll = () => {
        if (!messagesContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        // 맨 아래에서 150px 이내면 자동 스크롤 활성화
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isNearBottom = distanceFromBottom < 150;

        // 사용자가 위로 스크롤하면 자동 스크롤 비활성화
        setAutoScroll(isNearBottom);

        // 자동 스크롤이 비활성화되면 타이머도 정리
        if (!isNearBottom && scrollTimer) {
            clearInterval(scrollTimer);
            setScrollTimer(null);
        }
    };

    const scrollToBottom = () => {
        // messagesContainerRef를 사용해서 맨 아래로 스크롤
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadSessions = async () => {
        try {
            const sessionList = await sessionService.listSessions(userId);
            console.log('[Sessions] API Response:', sessionList);
            let sessionsArray: Session[] = [];

            // Ensure sessionList is an array, handle different API response formats
            if (Array.isArray(sessionList)) {
                sessionsArray = sessionList;
            } else if (sessionList && typeof sessionList === 'object' && 'sessions' in sessionList) {
                // Handle case where API returns { sessions: [...] }
                sessionsArray = (sessionList as any).sessions || [];
            } else {
                sessionsArray = [];
                console.warn('Unexpected session list format:', sessionList);
            }

            console.log('[Sessions] Loaded sessions count:', sessionsArray.length);
            setSessions(sessionsArray);

            // 세션이 없으면 자동으로 첫 세션 생성
            if (sessionsArray.length === 0) {
                console.log('[Auto] Creating first session');
                await handleCreateSession();
            } else if (!currentSessionId) {
                // 세션은 있지만 선택된 세션이 없으면 첫 번째 세션 선택
                setCurrentSessionId(sessionsArray[0].session_id);
            }
        } catch (err) {
            setSessions([]); // Ensure sessions is always an array even on error
            setError('세션 목록을 불러오는데 실패했습니다.');
            console.error(err);
        }
    };

    const loadMessages = async (sessionId: string) => {
        try {
            setLoading(true);

            // 메시지와 extra-info를 병렬로 로드
            const [history, extraInfo] = await Promise.all([
                sessionService.getSessionHistory(userId, sessionId),
                sessionService.getAllExtraInfo(userId, sessionId)
            ]);

            // extra-info 저장
            console.log('[Load Extra Info] Raw response:', extraInfo);
            console.log('[Load Extra Info] Keys:', Object.keys(extraInfo));
            setExtraInfoMap(extraInfo);

            let messageList: Message[] = [];

            // Ensure history is an array
            if (Array.isArray(history)) {
                messageList = history;
            } else if (history && typeof history === 'object' && 'messages' in history) {
                // Handle case where API returns { messages: [...] }
                messageList = (history as any).messages || [];
            } else {
                messageList = [];
                console.warn('Unexpected message history format:', history);
            }

            console.log('[Load Messages] Total messages from API:', messageList.length);

            // metadata에서 message_id 추출하여 매핑
            const normalizedMessages = messageList.map((msg: any) => {
                // assistant 메시지의 경우 metadata.message_id를 사용
                if (msg.role === 'assistant' && msg.metadata?.message_id) {
                    return {
                        ...msg,
                        message_id: msg.metadata.message_id,
                        timestamp: msg.metadata.timestamp || msg.timestamp,
                    };
                }
                // user 메시지의 경우 기존 message_id 사용
                return msg;
            });

            normalizedMessages.forEach((msg, idx) => {
                console.log(`[Message ${idx}]`, msg.role, 'message_id:', msg.message_id, msg.content?.substring(0, 100));
            });

            // Filter out messages with JSON content (assistant messages only)
            const filteredMessages = normalizedMessages.filter((msg) => {
                // Keep all user messages
                if (msg.role === 'user') {
                    return true;
                }

                // Filter out 'tool' role messages entirely
                if (msg.role === 'tool') {
                    console.log('[Filtering] Tool message detected:', msg.message_id);
                    return false;
                }

                // For assistant messages, check if content is JSON
                if (msg.role === 'assistant') {
                    const content = msg.content?.trim();

                    // Empty content
                    if (!content) {
                        console.log('[Filtering] Empty assistant message:', msg.message_id);
                        return false;
                    }

                    // Check if content starts with { or [
                    if (content.startsWith('{') || content.startsWith('[')) {
                        try {
                            // Try to parse as JSON
                            JSON.parse(content);
                            // If successful, it's JSON data - filter it out
                            console.log('[Filtering] JSON message detected:', msg.message_id, content.substring(0, 100));
                            return false;
                        } catch {
                            // Not valid JSON, keep the message
                            return true;
                        }
                    }

                    // Keep messages that don't look like JSON
                    return true;
                }

                // Filter out any unknown message types
                console.log('[Filtering] Unknown message role:', msg.role, msg.message_id);
                return false;
            });

            console.log('[Load Messages] Filtered messages:', filteredMessages.length);

            setMessages(filteredMessages);
            setError(null);
            // 메시지 로드 후 자동 스크롤 활성화
            setAutoScroll(true);
        } catch (err) {
            setMessages([]); // Ensure messages is always an array even on error
            setError('메시지를 불러오는데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async () => {
        try {
            const newSession = await sessionService.createSession(userId);
            setSessions([newSession, ...sessions]);
            setCurrentSessionId(newSession.session_id);
            setAutoScroll(true);
            setError(null);
        } catch (err) {
            setError('세션 생성에 실패했습니다.');
            console.error(err);
        }
    };

    const handleSelectSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        setAutoScroll(true);
    };

    const handleDeleteSession = async (sessionId: string) => {
        try {
            await sessionService.deleteSession(userId, sessionId);
            setSessions(sessions.filter((s) => s.session_id !== sessionId));
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
            }
            setError(null);
        } catch (err) {
            setError('세션 삭제에 실패했습니다.');
            console.error(err);
        }
    };

    const handleUpdateTitle = async (sessionId: string, title: string) => {
        try {
            await sessionService.updateSessionTitle(userId, sessionId, title);
            setSessions(
                sessions.map((s) =>
                    s.session_id === sessionId ? { ...s, title } : s
                )
            );
            setError(null);
        } catch (err) {
            setError('제목 수정에 실패했습니다.');
            console.error(err);
        }
    };

    const handleSendMessage = async (
        messageText: string,
        options: {
            thinkingMode: boolean;
            historyMode: boolean;
        }
    ) => {
        if (!currentSessionId) {
            setError('세션을 먼저 생성해주세요.');
            return;
        }

        // 사용자 메시지 추가
        const userMessage: Message = {
            message_id: Date.now(),
            role: 'user',
            content: messageText,
            timestamp: new Date().toISOString(),
        };
        setMessages([...messages, userMessage]);

        // 새 메시지를 보낼 때 자동 스크롤 활성화
        setAutoScroll(true);

        setLoading(true);
        setStreamingMessage('');
        setPendingExtraInfo(null);
        setError(null);

        const request: ChatRequest = {
            user_id: userId,
            session_id: currentSessionId,
            query: messageText,
            thinking_mode: options.thinkingMode,
            history_mode: options.historyMode,
        };

        try {
            await chatService.streamChat(
                request,
                (stage, message) => {
                    // 진행 상황 업데이트
                    console.log('[Progress]', stage, message);
                    setProgressStage(stage);
                    setProgressMessage(message);
                },
                (answer, extra_info, messageId) => {
                    // final 이벤트에서 받은 answer를 저장하고 타이핑 시작
                    console.log('[Final Answer]', answer);
                    console.log('[Extra Info]', extra_info);
                    console.log('[Message ID]', messageId);

                    // JSON 객체가 문자열로 변환되어 온 경우 무시
                    if (typeof answer === 'string' && answer.trim().startsWith('{')) {
                        try {
                            // JSON 파싱 시도 - 성공하면 JSON 데이터이므로 무시
                            JSON.parse(answer);
                            console.warn('Received JSON data instead of answer, ignoring:', answer);
                            return;
                        } catch {
                            // JSON이 아니므로 정상적인 답변으로 처리
                        }
                    }

                    setStreamingMessage(answer);
                    setAssistantMessageId(messageId);
                    setIsTyping(true);
                    setProgressStage('');
                    setProgressMessage('');

                    // extra_info 처리 (문자열 또는 객체)
                    let extra_info_map = null;

                    if (typeof extra_info === 'string' && extra_info.trim().startsWith('{')) {
                        try {
                            extra_info_map = JSON.parse(extra_info);
                        } catch {
                            // JSON 파싱 실패
                        }
                    } else if (typeof extra_info === 'object' && extra_info !== null) {
                        // 이미 객체인 경우
                        extra_info_map = extra_info;
                    }

                    // 시각화 데이터가 있으면 pendingExtraInfo에 저장 (타이핑 완료 후 extraInfoMap에 추가됨)
                    if (extra_info_map?.viz_type && extra_info_map?.viz_type !== 'none') {
                        console.log('[Visualization] Setting pending extra info:', extra_info_map);
                        setPendingExtraInfo({
                            viz_type: extra_info_map.viz_type,
                            chart_config: extra_info_map.chart_config,
                            query_result: extra_info_map.query_result
                        });
                    }
                },
                (err) => {
                    setError('메시지 전송에 실패했습니다.');
                    console.error(err);
                    setLoading(false);
                    setProgressStage('');
                    setProgressMessage('');
                }
            );

            // 타이핑 완료 후 메시지 추가는 onTypingComplete 콜백에서 처리
            // finalAnswer가 있으면 타이핑 시작됨
        } catch (err) {
            setError('메시지 전송에 실패했습니다.');
            console.error(err);
            setProgressStage('');
            setProgressMessage('');
            setLoading(false);
        }
    };

    const handleTypingComplete = async () => {
        console.log('[Typing Complete]');

        if (streamingMessage) {
            // 최종 확인: streamingMessage가 JSON이 아닌지 검증
            const trimmedAnswer = streamingMessage.trim();
            if (trimmedAnswer.startsWith('{') || trimmedAnswer.startsWith('[')) {
                try {
                    JSON.parse(trimmedAnswer);
                    console.error('[Error] Attempting to save JSON as message:', trimmedAnswer.substring(0, 100));
                    // JSON 데이터는 메시지로 저장하지 않음
                    setStreamingMessage('');
                    setAssistantMessageId(null);
                    setIsTyping(false);
                    setLoading(false);
                    return;
                } catch {
                    // JSON이 아니므로 정상 처리
                }
            }

            // 로컬 messages에 직접 추가 (API 재호출 없음)
            const messageId = assistantMessageId || Date.now();
            const assistantMessage: Message = {
                message_id: messageId,
                role: 'assistant',
                content: streamingMessage,
                timestamp: new Date().toISOString(),
            };
            setMessages(prevMessages => [...prevMessages, assistantMessage]);

            // pendingExtraInfo가 있으면 extraInfoMap에 추가
            if (pendingExtraInfo) {
                console.log('[Visualization] Adding extra info to map for message:', messageId);
                setExtraInfoMap(prev => ({
                    ...prev,
                    [String(messageId)]: pendingExtraInfo
                }));
                setPendingExtraInfo(null);
            }

            setStreamingMessage('');
            setAssistantMessageId(null);
            setIsTyping(false);
            setLoading(false);

            // 세션 제목 업데이트만 로드 (첫 메시지일 경우 백엔드에서 제목이 자동 생성됨)
            await loadSessions();
        }
    };

    const handleFeedback = async (
        messageId: number,
        feedbackType: 'thumbs_up' | 'thumbs_down'
    ) => {
        try {
            await feedbackService.submitFeedback({
                message_id: messageId,
                feedback_type: feedbackType,
            });

            // 로컬 상태 업데이트
            setMessages(
                messages.map((msg) =>
                    msg.message_id === messageId
                        ? { ...msg, feedback_type: feedbackType }
                        : msg
                )
            );
        } catch (err) {
            console.error('피드백 제출 실패:', err);
        }
    };

    return (
        <Box display="flex" height="100vh" justifyContent={"center"}>
            <SessionSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onUpdateTitle={handleUpdateTitle}
                userId={userId}
            />

            <Box
                flex={1}
                display="flex"
                flexDirection="column"
                p={2}
                maxWidth={"60%"}
                sx={{ height: '100vh', overflow: 'hidden' }}
            >
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    py: currentSessionId && messages.length > 0 ? 3 : 0,
                    px: currentSessionId && messages.length > 0 ? 4 : 0,
                    height: '100%',
                    overflow: 'hidden',
                    maxWidth: '100%'
                }}>
                    {error && (
                        <Alert
                            severity="error"
                            onClose={() => setError(null)}
                            sx={{
                                mb: 2,
                                mx: 4,
                                mt: 3,
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                            }}
                        >
                            {error}
                        </Alert>
                    )}

                    {!currentSessionId ? (
                        <Box
                            flex={1}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexDirection="column"
                        >
                            <Box
                                sx={{
                                    fontSize: 80,
                                    mb: 3,
                                    background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                💬
                            </Box>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    mb: 2,
                                    background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    textAlign: 'center',
                                }}
                            >
                                SAUS와 대화 시작하기
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
                                왼쪽 사이드바에서 '새 대화' 버튼을 클릭하여 시작하세요
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {messages.length === 0 && !loading ? (
                                <Box
                                    flex={1}
                                    display="flex"
                                    flexDirection="column"
                                    alignItems="center"
                                    justifyContent="center"
                                    gap={1.5}
                                >
                                    <Typography
                                        variant="h4"
                                        sx={{
                                            fontWeight: 600,
                                            color: 'text.primary',
                                            textAlign: 'center',
                                            mb: 0.5,
                                        }}
                                    >
                                        안녕하세요, SecuLayer SAUS 입니다.
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            color: 'text.secondary',
                                            textAlign: 'center',
                                            maxWidth: '40rem',
                                            mb: 1,
                                        }}
                                    >
                                        무엇을 도와드릴까요?
                                    </Typography>
                                    <Box width="100%" >
                                        <MessageInput
                                            onSendMessage={handleSendMessage}
                                            disabled={loading}
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <>
                                    <Box
                                        ref={messagesContainerRef}
                                        flex={1}
                                        overflow="auto"
                                        p={2}
                                        mb={2}
                                        sx={{
                                            minHeight: 0,
                                            overflowY: 'auto',
                                            overflowX: 'hidden'
                                        }}
                                        onScroll={handleScroll}
                                    >
                                        {messages.map((message, index) => (
                                            <ChatMessage
                                                key={message.message_id || `msg-${index}`}
                                                message={message}
                                                onFeedback={handleFeedback}
                                                extraInfo={extraInfoMap[String(message.message_id)]}
                                            />
                                        ))}

                                {progressStage && progressMessage && (
                                    <Stack direction={"row"} spacing={2}>
                                        <Avatar
                                        sx={{
                                            bgcolor: 'primary.main',
                                            width: 40,
                                            height: 40,
                                            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
                                            }}
                                        >
                                            <BotIcon />
                                        </Avatar>
                                        <ProgressIndicator
                                            stage={progressStage}
                                            message={progressMessage}
                                        />
                                    </Stack>
                                )}

                                {streamingMessage && (
                                    <ChatMessage
                                        message={{
                                            message_id: 0,
                                            role: 'assistant',
                                            content: streamingMessage,
                                            timestamp: new Date().toISOString(),
                                        }}
                                        onFeedback={handleFeedback}
                                        isTyping={isTyping}
                                        onTypingComplete={handleTypingComplete}
                                        extraInfo={pendingExtraInfo || undefined}
                                    />
                                )}

                                {loading && !streamingMessage && !progressStage && (
                                    <Box
                                        display="flex"
                                        justifyContent="center"
                                        alignItems="center"
                                        my={4}
                                        ml={0.5}
                                        mr={25}
                                        flexDirection="column"
                                        gap={2}
                                    >
                                        <CircularProgress
                                            sx={{
                                                color: 'primary.main',
                                                '& .MuiCircularProgress-circle': {
                                                    strokeLinecap: 'round',
                                                },
                                            }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                            응답을 생성하고 있습니다...
                                        </Typography>
                                    </Box>
                                )}

                                <div ref={messagesEndRef} />
                            </Box>

                            <Box >
                                <MessageInput
                                    onSendMessage={handleSendMessage}
                                    disabled={loading}
                                />
                            </Box>
                        </>
                    )}
                </>
                )}
                </Box>
            </Box>
        </Box>
    );
};