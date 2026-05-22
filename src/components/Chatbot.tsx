import { FC, useState, useEffect, useRef, useMemo, useCallback, DragEvent } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { SessionSidebar } from './SessionSidebar';
import { ChatMessage } from './ChatMessage';
import { Composer, ComposerHandle } from './Composer';
import { ProgressIndicator } from './ProgressIndicator';
import { Topbar } from './Topbar';
import { EmptyState } from './EmptyState';
import { SettingsDialog } from './SettingsDialog';
import { AdminLogsDialog } from './AdminLogsDialog';
import { Session, Message, ChatRequest, ExtraInfoMap, ExtraInfo, UploadedFile } from '../types/api';
import { chatService, sessionService, feedbackService, modelService, fileService, isAdminToken, StreamHandlers } from '../services/api';
import { AutoAwesome as BotIcon } from '@mui/icons-material';
import { useColorMode } from '../App';
import { useFavoriteSessions } from '../hooks/useFavoriteSessions';

// 안정된 빈 참조 — sessionId-keyed map에서 lookup 시 매 렌더마다 새 배열을 만들지 않도록
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_PROGRESS = { stage: '', message: '' };

interface ChatbotProps {
    userId: string;
}

export const Chatbot: FC<ChatbotProps> = ({ userId }) => {
    const { mode, toggle: toggleColorMode } = useColorMode();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // sessionId → 상태 매핑 (다중 세션 동시 진행을 위해 격리)
    const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
    const [streamingMap, setStreamingMap] = useState<Record<string, string>>({});
    const [progressMap, setProgressMap] = useState<Record<string, { stage: string; message: string }>>({});
    const [pendingExtraMap, setPendingExtraMap] = useState<Record<string, ExtraInfo | null>>({});
    const [activeTaskMap, setActiveTaskMap] = useState<Record<string, string>>({});
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
    // sessionId → SSE 구독 AbortController
    const subscriptionsRef = useRef<Record<string, AbortController>>({});
    // 이미 로드된 세션은 재방문 시 재fetch 안 함 (in-flight stream과 충돌 방지)
    const loadedSessionsRef = useRef<Set<string>>(new Set());
    // 진행 중 task를 두고 세션을 떠난 경우 — 재진입 시 메시지 캐시 무효화 필요
    const dirtySessionsRef = useRef<Set<string>>(new Set());
    // 새로고침 직후 snapshot으로 받은 사용자 질문 — DB에 아직 없으므로 loadMessages
    // 결과에 별도로 합쳐 넣어야 함. finalize 시점에 제거.
    const pendingUserQuestionRef = useRef<Record<string, string>>({});

    const [error, setError] = useState<string | null>(null);
    const [extraInfoMap, setExtraInfoMap] = useState<ExtraInfoMap>({});
    const [autoScroll, setAutoScroll] = useState(true);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [sessionFiles, setSessionFiles] = useState<UploadedFile[]>([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [uploadNotice, setUploadNotice] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    // 세션 진입 직후 첫 스크롤은 smooth 없이 즉시 하단으로
    const instantScrollRef = useRef(true);
    // 프로그래밍적 scrollIntoView가 발화시키는 scroll 이벤트와 사용자 스크롤을 구분
    const programmaticScrollRef = useRef(false);
    // 채팅 영역 드래그앤드롭 — Composer에 위임
    const composerRef = useRef<ComposerHandle | null>(null);
    const [dropOver, setDropOver] = useState(false);
    const dragCounterRef = useRef(0);
    const isAdmin = useMemo(() => isAdminToken(), []);
    const currentSession = sessions.find((s) => s.session_id === currentSessionId) || null;
    const { isFavorite, toggle: toggleFavorite, remove: removeFavorite } = useFavoriteSessions(userId);

    // 현재 세션 기준 렌더링 값 (map에서 lookup) — sid 변경 시에만 참조 갱신
    const sid = currentSessionId ?? '';
    const messages = messagesMap[sid] ?? EMPTY_MESSAGES;
    const streamingMessage = streamingMap[sid] ?? '';
    const progressStage = (progressMap[sid] ?? EMPTY_PROGRESS).stage;
    const progressMessage = (progressMap[sid] ?? EMPTY_PROGRESS).message;
    const pendingExtraInfo = pendingExtraMap[sid] ?? null;
    const loading = loadingMap[sid] ?? false;
    const activeTaskId = activeTaskMap[sid];

    // 세션별 파일 목록 fetch 시퀀스 카운터 — 동시 다중 갱신에서 stale 응답이 최신을 덮어쓰지 않도록
    const filesFetchSeqRef = useRef<Record<string, number>>({});
    // 현재 세션의 업로드 파일 목록 로드 — 세션 변경 시 + Composer 콜백으로 갱신
    const loadSessionFiles = async (sessionId: string) => {
        const seq = (filesFetchSeqRef.current[sessionId] ?? 0) + 1;
        filesFetchSeqRef.current[sessionId] = seq;
        try {
            const list = await fileService.listFiles(userId, sessionId);
            // 그 사이 더 새로운 요청이 들어왔다면 이 응답은 폐기
            if (filesFetchSeqRef.current[sessionId] !== seq) return;
            // 세션이 바뀌었다면 다른 세션의 목록을 덮어쓰지 않도록
            if (currentSessionId !== sessionId) return;
            setSessionFiles(Array.isArray(list) ? list : []);
        } catch (err) {
            if (filesFetchSeqRef.current[sessionId] !== seq) return;
            console.warn('세션 파일 목록 로드 실패:', err);
            if (currentSessionId === sessionId) setSessionFiles([]);
        }
    };

    useEffect(() => {
        if (currentSessionId) {
            loadSessionFiles(currentSessionId);
        } else {
            setSessionFiles([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSessionId]);

    const handleDeleteSessionFile = async (fileId: string) => {
        if (!currentSessionId) return;
        const prev = sessionFiles;
        setSessionFiles((p) => p.filter((f) => f.file_id !== fileId));
        try {
            await fileService.deleteFile(userId, currentSessionId, fileId);
        } catch (err) {
            console.warn('파일 삭제 실패, 목록 복원:', err);
            setSessionFiles(prev);
        }
    };

    const handleSessionFilesChanged = () => {
        if (currentSessionId) {
            loadSessionFiles(currentSessionId);
        }
    };

    // 세션 목록 및 모델 목록 로드
    useEffect(() => {
        loadSessions();
        loadModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // 현재 세션의 메시지 로드 — 이미 로드된 세션이면 캐시 사용
    useEffect(() => {
        if (currentSessionId && !loadedSessionsRef.current.has(currentSessionId)) {
            loadMessages(currentSessionId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSessionId]);

    // 현재 세션의 진행 중 task에 재구독 (페이지 새로고침/세션 전환 후 복귀)
    // cleanup: 세션을 떠날 때 SSE만 abort — 백엔드 task는 계속 진행됨 (cancel 호출 X)
    useEffect(() => {
        if (!currentSessionId) return;
        const sidParam = currentSessionId;
        let cancelled = false;

        if (!subscriptionsRef.current[sidParam]) {
            (async () => {
                try {
                    const active = await chatService.getActiveTask(userId, sidParam);
                    if (cancelled) return;
                    if (active.task_id) {
                        console.log('[Active task 재구독]', sidParam, active.task_id);
                        setActiveTaskMap((m) => ({ ...m, [sidParam]: active.task_id! }));
                        setLoadingMap((m) => ({ ...m, [sidParam]: true }));
                        attachSubscription(sidParam, active.task_id);
                    } else if (dirtySessionsRef.current.has(sidParam)) {
                        // 떠나있는 동안 task가 끝남 → DB의 최종 메시지 가져오기
                        dirtySessionsRef.current.delete(sidParam);
                        loadedSessionsRef.current.delete(sidParam);
                        setActiveTaskMap((m) => {
                            const next = { ...m };
                            delete next[sidParam];
                            return next;
                        });
                        setLoadingMap((m) => ({ ...m, [sidParam]: false }));
                        void loadMessages(sidParam);
                    }
                } catch (err) {
                    console.warn('[getActiveTask] 실패:', err);
                }
            })();
        }

        const dirtyRef = dirtySessionsRef;
        const subsRef = subscriptionsRef;
        return () => {
            cancelled = true;
            // 세션 떠날 때 SSE 구독만 abort (cancel은 호출하지 않음)
            const ctrl = subsRef.current[sidParam];
            if (ctrl) {
                // 진행 중 task를 두고 떠남 → 재진입 시 메시지 새로고침 필요 표시
                dirtyRef.current.add(sidParam);
                try { ctrl.abort(); } catch { /* noop */ }
                delete subsRef.current[sidParam];
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSessionId, userId]);

    // 페이지가 다시 보이면 현재 세션의 active task 재조회
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || !currentSessionId) return;
            const sidParam = currentSessionId;
            if (subscriptionsRef.current[sidParam]) return;
            (async () => {
                try {
                    const active = await chatService.getActiveTask(userId, sidParam);
                    if (active.task_id) {
                        setActiveTaskMap((m) => ({ ...m, [sidParam]: active.task_id! }));
                        setLoadingMap((m) => ({ ...m, [sidParam]: true }));
                        attachSubscription(sidParam, active.task_id);
                    }
                } catch { /* noop */ }
            })();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSessionId, userId]);

    // 컴포넌트 unmount 시 모든 SSE 구독 abort (백엔드 task는 계속 진행)
    useEffect(() => {
        return () => {
            Object.values(subscriptionsRef.current).forEach((c) => {
                try { c.abort(); } catch { /* noop */ }
            });
            subscriptionsRef.current = {};
        };
    }, []);

    // 자동 스크롤
    useEffect(() => {
        if (autoScroll) {
            scrollToBottom();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, streamingMessage, progressStage]);

    // 세션 전환 시 다음 스크롤은 즉시(instant) 동작하도록 마킹
    useEffect(() => {
        instantScrollRef.current = true;
        setAutoScroll(true);
    }, [currentSessionId]);

    // 업로드 알림 5초 자동 닫힘
    useEffect(() => {
        if (!uploadNotice) return;
        const t = setTimeout(() => setUploadNotice(null), 5000);
        return () => clearTimeout(t);
    }, [uploadNotice]);

    // 채팅 영역 전체에 대한 드래그앤드롭 — 드롭된 파일을 Composer 흐름으로 위임
    const canDropFiles = () => composerRef.current?.canAcceptFiles() ?? false;

    const handleAreaDragEnter = (e: DragEvent<HTMLDivElement>) => {
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
        if (!canDropFiles()) return;
        e.preventDefault();
        dragCounterRef.current += 1;
        setDropOver(true);
    };

    const handleAreaDragOver = (e: DragEvent<HTMLDivElement>) => {
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
        if (!canDropFiles()) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleAreaDragLeave = (e: DragEvent<HTMLDivElement>) => {
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
        e.preventDefault();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) setDropOver(false);
    };

    const handleAreaDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setDropOver(false);
        if (!canDropFiles()) return;
        const files = Array.from(e.dataTransfer?.files ?? []);
        if (files.length === 0) return;
        composerRef.current?.acceptFiles(files);
    };

    // 스크롤 이벤트 — 프로그래밍적 스크롤이 진행 중이면 무시(그렇지 않으면 자동 따라가기가 풀리지 않음)
    const handleScroll = () => {
        if (programmaticScrollRef.current) return;
        if (!messagesContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        // 바닥 가까이 있으면 다시 따라가기 켬, 위로 올라가면 끔
        setAutoScroll(distanceFromBottom < 80);
    };

    // 사용자가 휠/터치/키 입력으로 스크롤하면 프로그래밍 플래그를 해제 → 이후 scroll 이벤트는 사용자 의도로 처리
    const handleUserScrollIntent = () => {
        programmaticScrollRef.current = false;
    };

    const scrollToBottom = () => {
        // 세션 진입 직후엔 즉시 점프(스크롤 애니메이션 없음), 그 외엔 smooth
        const behavior: ScrollBehavior = instantScrollRef.current ? 'auto' : 'smooth';
        programmaticScrollRef.current = true;
        messagesEndRef.current?.scrollIntoView({ behavior });
        if (instantScrollRef.current) instantScrollRef.current = false;
        // smooth 스크롤 완료까지 여유를 두고 플래그 해제
        window.setTimeout(() => {
            programmaticScrollRef.current = false;
        }, 400);
    };

    const loadModels = async () => {
        try {
            const modelList = await modelService.getModels();
            setModels(modelList);
            if (modelList.length > 0) {
                setSelectedModel(modelList[0]);
            }
        } catch (err) {
            console.error('모델 목록 로드 실패:', err);
        }
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

            // 서버 응답에 active_task_id가 있는 세션은 activeTaskMap에 복원
            const restored: Record<string, string> = {};
            sessionsArray.forEach((s) => {
                if (s.active_task_id) restored[s.session_id] = s.active_task_id;
            });
            if (Object.keys(restored).length > 0) {
                setActiveTaskMap((prev) => ({ ...prev, ...restored }));
            }

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
            setLoadingMap((m) => ({ ...m, [sessionId]: true }));

            // 메시지와 extra-info를 병렬로 로드
            const [history, extraInfo] = await Promise.all([
                sessionService.getSessionHistory(userId, sessionId),
                sessionService.getAllExtraInfo(userId, sessionId)
            ]);

            // extra-info 저장 — 다른 세션 데이터는 보존하고 병합
            console.log('[Load Extra Info] Raw response:', extraInfo);
            console.log('[Load Extra Info] Keys:', Object.keys(extraInfo));
            setExtraInfoMap((prev) => ({ ...prev, ...extraInfo }));

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
                        model: msg.metadata.model ?? null,
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

            // 새로고침 등으로 인해 진행 중 task의 사용자 질문이 DB엔 아직 없을 수 있음.
            // snapshot이 먼저 도착해 ref에 보관해 둔 질문이 있다면 합쳐 넣는다.
            // (snapshot이 나중에 오는 경우엔 거기서 별도로 messagesMap에 합쳐 줌)
            const pendingQuestion = pendingUserQuestionRef.current[sessionId];
            let mergedMessages = filteredMessages;
            if (pendingQuestion) {
                const last = filteredMessages[filteredMessages.length - 1];
                if (!(last?.role === 'user' && last?.content === pendingQuestion)) {
                    mergedMessages = [
                        ...filteredMessages,
                        {
                            message_id: Date.now(),
                            role: 'user',
                            content: pendingQuestion,
                            timestamp: new Date().toISOString(),
                        },
                    ];
                }
            }

            setMessagesMap((m) => ({ ...m, [sessionId]: mergedMessages }));
            loadedSessionsRef.current.add(sessionId);
            setError(null);
            // 메시지 로드 후 자동 스크롤 활성화
            setAutoScroll(true);
        } catch (err) {
            setMessagesMap((m) => ({ ...m, [sessionId]: [] }));
            setError('메시지를 불러오는데 실패했습니다.');
            console.error(err);
        } finally {
            setLoadingMap((m) => {
                // 진행 중 task 구독이 활성이면 loading은 그대로 유지
                if (subscriptionsRef.current[sessionId]) return m;
                return { ...m, [sessionId]: false };
            });
        }
    };

    const handleCreateSession = async () => {
        try {
            const newSession = await sessionService.createSession(userId);
            setSessions((prev) => [newSession, ...prev]);
            setCurrentSessionId(newSession.session_id);
            setAutoScroll(true);
            setError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '';
            if (errorMessage.toLowerCase().includes('session limit')) {
                setError('채팅방 수가 최대 한도에 도달했습니다. 기존 채팅방을 삭제한 후 새로 생성해주세요.');
            } else {
                setError('세션 생성에 실패했습니다.');
            }
            console.error(err);
        }
    };

    const handleSelectSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        setAutoScroll(true);
    };

    const handleDeleteSession = async (sessionId: string) => {
        try {
            // 진행 중인 task가 있다면 먼저 취소
            const taskId = activeTaskMap[sessionId];
            if (taskId) {
                try { await chatService.cancelTask(taskId); } catch { /* noop */ }
            }
            // SSE 구독 abort
            const ctrl = subscriptionsRef.current[sessionId];
            if (ctrl) {
                try { ctrl.abort(); } catch { /* noop */ }
                delete subscriptionsRef.current[sessionId];
            }
            // 세션 관련 로컬 상태 정리
            loadedSessionsRef.current.delete(sessionId);
            setMessagesMap((m) => { const n = { ...m }; delete n[sessionId]; return n; });
            setStreamingMap((m) => { const n = { ...m }; delete n[sessionId]; return n; });
            setProgressMap((m) => { const n = { ...m }; delete n[sessionId]; return n; });
            setPendingExtraMap((m) => { const n = { ...m }; delete n[sessionId]; return n; });
            setLoadingMap((m) => { const n = { ...m }; delete n[sessionId]; return n; });
            setActiveTaskMap((m) => { const n = { ...m }; delete n[sessionId]; return n; });

            await sessionService.deleteSession(userId, sessionId);
            setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
            setCurrentSessionId((prev) => (prev === sessionId ? null : prev));
            removeFavorite(sessionId);
            setError(null);
        } catch (err) {
            setError('세션 삭제에 실패했습니다.');
            console.error(err);
        }
    };

    const handleUpdateTitle = async (sessionId: string, title: string) => {
        try {
            await sessionService.updateSessionTitle(userId, sessionId, title);
            setSessions((prev) =>
                prev.map((s) => (s.session_id === sessionId ? { ...s, title } : s))
            );
            setError(null);
        } catch (err) {
            setError('제목 수정에 실패했습니다.');
            console.error(err);
        }
    };

    // 세션별 task 종료 처리 — 어떤 콜백에서 호출되든 sid에 격리된 상태만 정리
    const finalizeForSession = useCallback(
        (
            sidParam: string,
            finalText: string,
            extra_info: any,
            messageId: number | null,
        ) => {
            const cleanup = () => {
                setStreamingMap((m) => ({ ...m, [sidParam]: '' }));
                setPendingExtraMap((m) => ({ ...m, [sidParam]: null }));
                setProgressMap((m) => ({ ...m, [sidParam]: EMPTY_PROGRESS }));
                setLoadingMap((m) => ({ ...m, [sidParam]: false }));
                setActiveTaskMap((m) => {
                    const next = { ...m };
                    delete next[sidParam];
                    return next;
                });
                delete subscriptionsRef.current[sidParam];
                delete pendingUserQuestionRef.current[sidParam];
            };

            const trimmed = finalText.trim();

            // 빈 응답 또는 JSON 응답은 메시지로 저장하지 않음
            const isJson =
                trimmed.length > 0 &&
                (trimmed.startsWith('{') || trimmed.startsWith('['))
                && (() => {
                    try { JSON.parse(trimmed); return true; } catch { return false; }
                })();

            if (!trimmed || isJson) {
                if (isJson) console.warn('[Skipping] streamed text is JSON, not saving as message');
                cleanup();
                void loadSessions();
                return;
            }

            const msgId = messageId ?? Date.now();
            const assistantMessage: Message = {
                message_id: msgId,
                role: 'assistant',
                content: finalText,
                timestamp: new Date().toISOString(),
            };
            setMessagesMap((m) => ({
                ...m,
                [sidParam]: [...(m[sidParam] ?? []), assistantMessage],
            }));

            // extra_info 파싱 → 시각화 데이터
            let extra_info_map: any = null;
            if (typeof extra_info === 'string' && extra_info.trim().startsWith('{')) {
                try { extra_info_map = JSON.parse(extra_info); } catch { /* noop */ }
            } else if (typeof extra_info === 'object' && extra_info !== null) {
                extra_info_map = extra_info;
            }
            if (extra_info_map?.viz_type && extra_info_map?.viz_type !== 'none') {
                setExtraInfoMap((prev) => ({
                    ...prev,
                    [String(msgId)]: {
                        viz_type: extra_info_map.viz_type,
                        chart_config: extra_info_map.chart_config,
                        query_result: extra_info_map.query_result,
                    },
                }));
            }

            cleanup();
            void loadSessions();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // 세션 task 구독을 위한 StreamHandlers 빌더 — 콜백은 sid를 클로저 캡처
    const buildHandlers = useCallback(
        (sidParam: string): StreamHandlers => ({
            onSnapshot: (snap) => {
                if (snap.status === 'running') {
                    // 본문 버퍼를 누적 텍스트로 set (재구독 시 이어보기)
                    setStreamingMap((m) => ({ ...m, [sidParam]: snap.accumulated_answer }));
                    if (snap.last_progress) {
                        setProgressMap((m) => ({ ...m, [sidParam]: snap.last_progress! }));
                    }
                    // 새로고침 직후엔 사용자 질문이 DB에 아직 없을 수 있음 →
                    // snapshot으로 받은 질문을 messagesMap 말단에 합쳐 넣는다.
                    // loadMessages가 나중에 끝나도 ref에 보관해 두면 거기서도 합쳐줌.
                    if (snap.user_question) {
                        pendingUserQuestionRef.current[sidParam] = snap.user_question;
                        setMessagesMap((m) => {
                            const list = m[sidParam] ?? [];
                            const last = list[list.length - 1];
                            if (last?.role === 'user' && last?.content === snap.user_question) {
                                return m;
                            }
                            const userMsg: Message = {
                                message_id: Date.now(),
                                role: 'user',
                                content: snap.user_question,
                                timestamp: new Date().toISOString(),
                            };
                            return { ...m, [sidParam]: [...list, userMsg] };
                        });
                    }
                } else {
                    // 이미 종료된 task에 재구독한 경우 — DB에 메시지가 있으므로 캐시 무효화 후 refetch
                    setStreamingMap((m) => ({ ...m, [sidParam]: '' }));
                    setProgressMap((m) => ({ ...m, [sidParam]: EMPTY_PROGRESS }));
                    setLoadingMap((m) => ({ ...m, [sidParam]: false }));
                    setActiveTaskMap((m) => {
                        const next = { ...m };
                        delete next[sidParam];
                        return next;
                    });
                    delete subscriptionsRef.current[sidParam];
                    delete pendingUserQuestionRef.current[sidParam];
                    loadedSessionsRef.current.delete(sidParam);
                    void loadMessages(sidParam);
                }
            },
            onProgress: (stage, message) => {
                setProgressMap((m) => ({ ...m, [sidParam]: { stage, message } }));
            },
            onAnswerDelta: (delta) => {
                setStreamingMap((m) => ({ ...m, [sidParam]: (m[sidParam] ?? '') + delta }));
                // 첫 토큰 도착하면 progress 숨김
                setProgressMap((m) => {
                    const cur = m[sidParam];
                    if (!cur?.stage) return m;
                    return { ...m, [sidParam]: EMPTY_PROGRESS };
                });
            },
            onAnswerCancel: () => {
                // 도구 호출 직전 누적된 본문은 도구 preamble이라 폐기
                setStreamingMap((m) => ({ ...m, [sidParam]: '' }));
            },
            onFinalAnswer: (answer, extra_info, messageId) => {
                console.log('[Final Answer]', sidParam, messageId);
                finalizeForSession(sidParam, answer, extra_info, messageId);
            },
            onCancelled: () => {
                // 사용자가 명시적으로 중단 — 누적된 부분 답변을 그대로 저장
                setStreamingMap((m) => {
                    const partial = m[sidParam] ?? '';
                    queueMicrotask(() => {
                        finalizeForSession(sidParam, partial, null, null);
                    });
                    return m;
                });
            },
            onError: (err) => {
                console.error('[SSE error]', sidParam, err);
                setError('메시지 전송에 실패했습니다.');
                setLoadingMap((m) => ({ ...m, [sidParam]: false }));
                setProgressMap((m) => ({ ...m, [sidParam]: EMPTY_PROGRESS }));
                setActiveTaskMap((m) => {
                    const next = { ...m };
                    delete next[sidParam];
                    return next;
                });
                delete subscriptionsRef.current[sidParam];
                delete pendingUserQuestionRef.current[sidParam];
            },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [finalizeForSession],
    );

    // task_id에 구독 — 이미 구독 중이면 새로 만들지 않음
    const attachSubscription = useCallback(
        (sidParam: string, taskId: string) => {
            if (subscriptionsRef.current[sidParam]) return;
            const ctrl = chatService.subscribeTask(taskId, buildHandlers(sidParam));
            subscriptionsRef.current[sidParam] = ctrl;
        },
        [buildHandlers],
    );

    const handleSendMessage = async (
        messageText: string,
        options: {
            thinkingMode: boolean;
            selectedModel: string | null;
            reasoningEffort: string | null;
            fileIds: string[];
        }
    ) => {
        if (!currentSessionId) {
            setError('세션을 먼저 생성해주세요.');
            return;
        }
        const sidParam = currentSessionId; // 클로저에 캡처

        // 사용자 메시지 추가 (sidParam에 한정)
        const userMessage: Message = {
            message_id: Date.now(),
            role: 'user',
            content: messageText,
            timestamp: new Date().toISOString(),
        };
        setMessagesMap((m) => ({
            ...m,
            [sidParam]: [...(m[sidParam] ?? []), userMessage],
        }));
        setAutoScroll(true);

        setLoadingMap((m) => ({ ...m, [sidParam]: true }));
        setStreamingMap((m) => ({ ...m, [sidParam]: '' }));
        setPendingExtraMap((m) => ({ ...m, [sidParam]: null }));
        setProgressMap((m) => ({ ...m, [sidParam]: EMPTY_PROGRESS }));
        setError(null);

        const request: ChatRequest = {
            user_id: userId,
            session_id: sidParam,
            query: messageText,
            model: options.selectedModel,
            thinking_mode: options.thinkingMode,
            reasoning_effort: options.reasoningEffort,
            history_mode: true,
            file_ids: options.fileIds.length > 0 ? options.fileIds : null,
        };

        try {
            const started = await chatService.startChatTask(request);
            const taskId = started.ok ? started.data.task_id : started.conflict;
            if (!started.ok) {
                console.warn('[409 Conflict] 기존 task에 재구독:', taskId);
            }
            setActiveTaskMap((m) => ({ ...m, [sidParam]: taskId }));
            attachSubscription(sidParam, taskId);
        } catch (err) {
            console.error('[startChatTask] 실패:', err);
            setError('메시지 전송에 실패했습니다.');
            setLoadingMap((m) => ({ ...m, [sidParam]: false }));
            setProgressMap((m) => ({ ...m, [sidParam]: EMPTY_PROGRESS }));
        }
    };

    // 정지 버튼 — 현재 세션의 진행 중 task 취소
    const handleCancelCurrentTask = async () => {
        if (!currentSessionId) return;
        const taskId = activeTaskMap[currentSessionId];
        if (!taskId) return;
        try {
            await chatService.cancelTask(taskId);
            // SSE에서 'cancelled' 이벤트가 자연스럽게 들어와 finalize 됨
        } catch (err) {
            console.error('[cancelTask] 실패:', err);
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

            // 로컬 상태 업데이트 — 현재 세션의 메시지만 갱신
            if (currentSessionId) {
                const sidParam = currentSessionId;
                setMessagesMap((m) => ({
                    ...m,
                    [sidParam]: (m[sidParam] ?? []).map((msg) =>
                        msg.message_id === messageId
                            ? { ...msg, feedback_type: feedbackType }
                            : msg
                    ),
                }));
            }
        } catch (err) {
            console.error('피드백 제출 실패:', err);
        }
    };

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                height: '100vh',
                width: '100vw',
                overflow: 'hidden',
                position: 'relative',
                background:
                    'radial-gradient(1200px 600px at 30% -10%, var(--accent-soft) 0%, transparent 55%), var(--bg)',
                '&::before': {
                    content: '""',
                    position: 'fixed',
                    inset: 0,
                    backgroundImage: 'radial-gradient(var(--bg-grid) 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                    pointerEvents: 'none',
                    maskImage:
                        'radial-gradient(ellipse at center, #000 50%, transparent 90%)',
                    WebkitMaskImage:
                        'radial-gradient(ellipse at center, #000 50%, transparent 90%)',
                    zIndex: 0,
                },
            }}
        >
            <SessionSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onUpdateTitle={handleUpdateTitle}
                userId={userId}
                activeTaskMap={activeTaskMap}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
            />

            <Box
                flex={1}
                display="flex"
                flexDirection="column"
                sx={{ height: '100vh', overflow: 'hidden', minWidth: 0, position: 'relative' }}
                onDragEnter={handleAreaDragEnter}
                onDragOver={handleAreaDragOver}
                onDragLeave={handleAreaDragLeave}
                onDrop={handleAreaDrop}
            >
                <Topbar
                    sessionId={currentSessionId}
                    sessionTitle={currentSession?.title || null}
                    modelName={selectedModel}
                    mode={mode}
                    onToggleMode={toggleColorMode}
                    onOpenAdmin={() => setAdminOpen(true)}
                    onOpenSettings={() => setSettingsOpen(true)}
                    isAdmin={isAdmin}
                    onRenameSession={handleUpdateTitle}
                    onDeleteSession={handleDeleteSession}
                    isFavorite={currentSessionId ? isFavorite(currentSessionId) : false}
                    onToggleFavorite={toggleFavorite}
                />
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    py: 3,
                    px: 4,
                    maxWidth: 960,
                    width: '100%',
                    mx: 'auto',
                    overflow: 'hidden',
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
                                    background: 'linear-gradient(135deg, #3FD5BA 0%, #1A8B7E 100%)',
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
                                    background: 'linear-gradient(135deg, #3FD5BA 0%, #1A8B7E 100%)',
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
                                    justifyContent="center"
                                    gap={2}
                                >
                                    <EmptyState
                                        disabled={loading}
                                        onSelectPrompt={(prompt) =>
                                            handleSendMessage(prompt, {
                                                thinkingMode: false,
                                                selectedModel,
                                                reasoningEffort: null,
                                                fileIds: sessionFiles.map((f) => f.file_id).filter(Boolean),
                                            })
                                        }
                                    />
                                    <Box width="100%">
                                        <Composer
                                            ref={composerRef}
                                            onSendMessage={handleSendMessage}
                                            disabled={loading}
                                            models={models}
                                            selectedModel={selectedModel}
                                            onModelChange={setSelectedModel}
                                            userId={userId}
                                            sessionId={currentSessionId}
                                            onFilesChanged={handleSessionFilesChanged}
                                            sessionFiles={sessionFiles}
                                            onDeleteSessionFile={handleDeleteSessionFile}
                                            isRunning={!!activeTaskId}
                                            onCancel={handleCancelCurrentTask}
                                            onUploadError={setUploadNotice}
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <>
                                    <Box
                                        ref={messagesContainerRef}
                                        flex={1}
                                        overflow="auto"
                                        py={2}
                                        mb={2}
                                        sx={{
                                            minHeight: 0,
                                            overflowY: 'auto',
                                            overflowX: 'hidden'
                                        }}
                                        onScroll={handleScroll}
                                        onWheel={handleUserScrollIntent}
                                        onTouchStart={handleUserScrollIntent}
                                        onKeyDown={handleUserScrollIntent}
                                    >
                                        {messages.map((message, index) => (
                                            <ChatMessage
                                                key={message.message_id || `msg-${index}`}
                                                message={message}
                                                onFeedback={handleFeedback}
                                                extraInfo={extraInfoMap[String(message.message_id)]}
                                                userInitial={(userId || 'U').trim().charAt(0).toUpperCase() || 'U'}
                                            />
                                        ))}

                                {progressStage && progressMessage && !streamingMessage && (
                                    <div className="msg bot">
                                        <div className="msg-avatar bot">
                                            <BotIcon style={{ fontSize: 16 }} />
                                        </div>
                                        <div className="msg-body">
                                            <ProgressIndicator stage={progressStage} message={progressMessage} />
                                        </div>
                                    </div>
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
                                        streaming
                                        extraInfo={pendingExtraInfo || undefined}
                                        userInitial={(userId || 'U').trim().charAt(0).toUpperCase() || 'U'}
                                    />
                                )}

                                {loading && !streamingMessage && !progressStage && (
                                    <div className="msg bot">
                                        <div className="msg-avatar bot">
                                            <BotIcon style={{ fontSize: 16 }} />
                                        </div>
                                        <div className="msg-body">
                                            <ProgressIndicator stage="generating_answer" />
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </Box>

                            <Box >
                                <Composer
                                    ref={composerRef}
                                    onSendMessage={handleSendMessage}
                                    disabled={loading}
                                    models={models}
                                    selectedModel={selectedModel}
                                    onModelChange={setSelectedModel}
                                    userId={userId}
                                    sessionId={currentSessionId}
                                    onFilesChanged={handleSessionFilesChanged}
                                    sessionFiles={sessionFiles}
                                    onDeleteSessionFile={handleDeleteSessionFile}
                                    isRunning={!!activeTaskId}
                                    onCancel={handleCancelCurrentTask}
                                    onUploadError={setUploadNotice}
                                />
                            </Box>
                        </>
                    )}
                </>
                )}
                </Box>

                {/* 채팅 영역 전체 드래그앤드롭 오버레이 */}
                {dropOver && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 16,
                            top: 68,
                            zIndex: 20,
                            border: '2px dashed',
                            borderColor: 'primary.main',
                            borderRadius: '14px',
                            bgcolor: 'rgba(63, 213, 186, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            color: 'primary.main',
                            fontSize: 15,
                            fontWeight: 600,
                            pointerEvents: 'none',
                            backdropFilter: 'blur(2px)',
                        }}
                    >
                        <Box sx={{ fontSize: 36 }}>📎</Box>
                        파일을 여기에 놓아 업로드
                    </Box>
                )}

                {/* 메인 영역 내부 상단 중앙 toast — 사이드바 폭과 무관하게 컨텐츠 컬럼 중앙 정렬 */}
                {uploadNotice && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 68,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                            minWidth: 280,
                            maxWidth: 'min(560px, 90%)',
                        }}
                    >
                        <Alert
                            severity="error"
                            variant="standard"
                            onClose={() => setUploadNotice(null)}
                            sx={(theme) => ({
                                borderRadius: '10px',
                                fontSize: 13.5,
                                fontWeight: 500,
                                boxShadow:
                                    theme.palette.mode === 'dark'
                                        ? '0 8px 28px rgba(0,0,0,0.45)'
                                        : '0 6px 24px rgba(220, 38, 38, 0.18)',
                                border: '1px solid',
                                borderColor:
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(248, 113, 113, 0.55)'
                                        : 'rgba(220, 38, 38, 0.35)',
                                bgcolor:
                                    theme.palette.mode === 'dark'
                                        ? '#3b0a0a'
                                        : '#fee2e2',
                                backdropFilter: 'none',
                                color:
                                    theme.palette.mode === 'dark'
                                        ? '#fecaca'
                                        : '#991b1b',
                                '& .MuiAlert-icon': {
                                    color:
                                        theme.palette.mode === 'dark'
                                            ? '#f87171'
                                            : '#dc2626',
                                },
                                '& .MuiAlert-action .MuiIconButton-root': {
                                    color:
                                        theme.palette.mode === 'dark'
                                            ? '#fca5a5'
                                            : '#991b1b',
                                },
                            })}
                        >
                            {uploadNotice}
                        </Alert>
                    </Box>
                )}
            </Box>

            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} userId={userId} />
            <AdminLogsDialog open={adminOpen} onClose={() => setAdminOpen(false)} />
        </Box>
    );
};