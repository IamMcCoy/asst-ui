import {
    forwardRef,
    useState,
    useRef,
    useEffect,
    useImperativeHandle,
    KeyboardEvent,
    ChangeEvent,
} from 'react';
import {
    Tooltip,
    Popover,
    MenuItem,
    MenuList,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import { ToolSelector } from './ToolSelector';
import { ModelSelector } from './ModelSelector';
import { SessionFiles } from './SessionFiles';
import { fileService } from '../services/api';
import { UploadedFile } from '../types/api';
import { formatFileSize } from '../utils/format';
import {
    IconPaperclip,
    IconStop,
    IconBrain,
    IconGauge,
    IconHistory,
    IconTool,
    IconFile,
    IconX,
} from './icons';
import './Composer.css';

interface ComposerProps {
    onSendMessage: (
        message: string,
        options: {
            thinkingMode: boolean;
            selectedModel: string | null;
            reasoningEffort: string | null;
            historyMode: boolean;
            fileIds: string[];
        }
    ) => void;
    disabled?: boolean;
    models?: string[];
    selectedModel?: string | null;
    onModelChange?: (model: string | null) => void;
    userId: string;
    sessionId: string | null;
    onFilesChanged?: () => void;
    sessionFiles?: UploadedFile[];
    onDeleteSessionFile?: (fileId: string) => Promise<void> | void;
    // 진행 중인 task가 있을 때 정지 버튼 노출 — 클릭 시 onCancel 호출
    isRunning?: boolean;
    onCancel?: () => void;
    // 업로드 실패 알림 콜백 (Snackbar/toast로 노출)
    onUploadError?: (message: string) => void;
    // 파일 칩 클릭 → 우측 문서 패널에서 원본 열기
    onOpenSessionFile?: (fileId: string) => void;
}

// 부모(Chatbot 메인 영역)가 드롭한 파일을 Composer 업로드 흐름으로 연결할 수 있도록 노출
export interface ComposerHandle {
    acceptFiles: (files: File[]) => void;
    canAcceptFiles: () => boolean;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({
    onSendMessage,
    disabled = false,
    models = [],
    selectedModel = null,
    onModelChange,
    userId,
    sessionId,
    onFilesChanged,
    sessionFiles = [],
    onDeleteSessionFile,
    isRunning = false,
    onCancel,
    onUploadError,
    onOpenSessionFile,
}, ref) {
    const [message, setMessage] = useState('');
    const [thinkingMode, setThinkingMode] = useState(false);
    const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);
    const [historyMode, setHistoryMode] = useState(true);
    const [reasoningAnchor, setReasoningAnchor] = useState<HTMLElement | null>(null);
    const [uploadingNames, setUploadingNames] = useState<string[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // 추론 강도(reasoning_effort)를 지원하는 모델 — 사고 모드 대신 추론 강도 사용
    const isReasoningModel = /gpt-oss|solar-open2/.test(selectedModel?.toLowerCase() ?? '');
    const isUploading = uploadingNames.length > 0;
    const canSend = message.trim().length > 0 && !disabled && !isUploading;

    // 세션 변경 시 인풋 상태 초기화
    useEffect(() => {
        setUploadingNames([]);
        setPendingFiles([]);
        setUploadDialogOpen(false);
    }, [sessionId]);

    // textarea 자동 높이 — min 48 / max 220, max 초과 시에만 스크롤
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const next = Math.min(Math.max(el.scrollHeight, 50), 220);
        el.style.height = next + 'px';
        el.style.overflowY = el.scrollHeight > 220 ? 'auto' : 'hidden';
    }, [message]);

    const handleSend = () => {
        if (!canSend) return;
        onSendMessage(message.trim(), {
            thinkingMode: isReasoningModel ? false : thinkingMode,
            selectedModel,
            reasoningEffort: isReasoningModel ? reasoningEffort ?? 'low' : null,
            historyMode,
            fileIds: sessionFiles.map((f) => f.file_id).filter(Boolean),
        });
        setMessage('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleAttachClick = () => {
        if (!sessionId || disabled || isUploading) return;
        fileInputRef.current?.click();
    };

    // 파일 input/드래그앤드롭 공통 진입점 — 설명 입력 다이얼로그로 연결
    const acceptFiles = (files: File[]) => {
        if (!sessionId || files.length === 0 || disabled || isUploading) return;
        setPendingFiles(files);
        setUploadDialogOpen(true);
    };

    // 부모(Chatbot)가 채팅 영역 드롭으로 받은 파일을 Composer로 전달할 수 있게 노출
    useImperativeHandle(
        ref,
        () => ({
            acceptFiles,
            canAcceptFiles: () => !!sessionId && !disabled && !isUploading,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sessionId, disabled, isUploading]
    );

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        e.target.value = '';
        acceptFiles(files);
    };


    const removePendingFile = (idx: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleCancelUploadDialog = () => {
        setUploadDialogOpen(false);
        setPendingFiles([]);
    };

    const handleConfirmUploadDialog = async () => {
        if (!sessionId || pendingFiles.length === 0) {
            setUploadDialogOpen(false);
            return;
        }
        const toUpload = pendingFiles;
        setUploadDialogOpen(false);
        setPendingFiles([]);
        setUploadingNames((prev) => [...prev, ...toUpload.map((f) => f.name)]);

        // 업로드 전 현재 파일명 카운트 — 사후에 동일 파일명이 늘었는지 비교해서 5xx 등으로 throw됐지만 실제로는 저장된 경우를 식별
        const preFilenameCounts = new Map<string, number>();
        sessionFiles.forEach((f) => {
            preFilenameCounts.set(f.filename, (preFilenameCounts.get(f.filename) ?? 0) + 1);
        });

        type UploadOutcome =
            | { file: File; kind: 'success' }
            | { file: File; kind: 'noid' }
            | { file: File; kind: 'thrown'; error: string };

        const results: UploadOutcome[] = await Promise.all(
            toUpload.map(async (file): Promise<UploadOutcome> => {
                try {
                    const uploaded = await fileService.uploadFile(userId, sessionId, file);
                    return uploaded.file_id
                        ? { file, kind: 'success' }
                        : { file, kind: 'noid' };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : '업로드 실패';
                    return { file, kind: 'thrown', error: msg };
                } finally {
                    setUploadingNames((prev) => {
                        const idx = prev.indexOf(file.name);
                        if (idx < 0) return prev;
                        const next = [...prev];
                        next.splice(idx, 1);
                        return next;
                    });
                }
            })
        );

        const successes = results.filter((r) => r.kind === 'success');
        const failures = results.filter((r) => r.kind !== 'success') as Exclude<UploadOutcome, { kind: 'success' }>[];

        // 실패로 보고된 건이 있다면 — 게이트웨이 타임아웃 등으로 5xx 응답이지만 실제로는 저장됐을 가능성 검증
        let postList: UploadedFile[] | null = null;
        if (failures.length > 0) {
            try {
                postList = await fileService.listFiles(userId, sessionId);
            } catch { /* 검증 실패해도 에러 토스트는 그대로 띄움 */ }
        }
        const postFilenameCounts = new Map<string, number>();
        (postList ?? []).forEach((f) => {
            postFilenameCounts.set(f.filename, (postFilenameCounts.get(f.filename) ?? 0) + 1);
        });

        // failure를 파일명별로 그룹핑해서 사후 count - 사전 count 만큼 success로 흡수
        let recoveredAny = false;
        const errorsByFile = new Map<string, string[]>();
        for (const r of failures) {
            const name = r.file.name;
            const pre = preFilenameCounts.get(name) ?? 0;
            const post = postFilenameCounts.get(name) ?? 0;
            if (post > pre) {
                // 한 건 흡수
                preFilenameCounts.set(name, pre + 1);
                recoveredAny = true;
            } else {
                const msg = r.kind === 'thrown' ? r.error : '업로드에 실패했습니다.';
                const arr = errorsByFile.get(name) ?? [];
                arr.push(msg);
                errorsByFile.set(name, arr);
            }
        }
        errorsByFile.forEach((msgs, name) => {
            onUploadError?.(`${name}: ${msgs[0]}`);
        });

        // 성공 or 사후 검증으로 흡수된 게 있으면 부모에게 목록 갱신 요청
        if (successes.length > 0 || recoveredAny) onFilesChanged?.();
    };

    const effectiveEffort = reasoningEffort ?? 'low';
    const reasoningLabel = `추론: ${effectiveEffort.charAt(0).toUpperCase() + effectiveEffort.slice(1)}`;

    return (
        <div className="composer-wrap">
            <div className="composer">
                <div className="composer-input">
                    <Tooltip
                        title={!sessionId ? '세션 생성 후 첨부 가능' : isUploading ? '업로드 중' : '파일 첨부'}
                        arrow
                    >
                        <span>
                            <button
                                type="button"
                                className="cmp-icon-btn"
                                onClick={handleAttachClick}
                                disabled={!sessionId || disabled || isUploading}
                                aria-label="파일 첨부"
                            >
                                <IconPaperclip />
                            </button>
                        </span>
                    </Tooltip>
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="무엇이든 물어보세요 — IP 분석, CTI 조회, 로그 요약…"
                        disabled={disabled}
                        rows={2}
                    />
                </div>

                {onDeleteSessionFile && sessionFiles.length > 0 && (
                    <div style={{ padding: '0 20px' }}>
                        <SessionFiles files={sessionFiles} onDelete={onDeleteSessionFile} onOpen={onOpenSessionFile} />
                    </div>
                )}

                {uploadingNames.length > 0 && (
                    <div className="composer-upload-active" role="status" aria-live="polite">
                        <div className="composer-upload-active-head">
                            <span className="composer-upload-spinner" aria-hidden />
                            <span className="composer-upload-active-title">
                                {uploadingNames.length === 1
                                    ? '파일 업로드 중'
                                    : `${uploadingNames.length}개 파일 업로드 중`}
                            </span>
                            <span className="composer-upload-active-count">
                                {uploadingNames.length}
                            </span>
                        </div>
                        <div className="composer-upload-active-list">
                            {uploadingNames.map((name) => (
                                <div className="composer-upload-active-row" key={`uploading-${name}`}>
                                    <IconFile className="ic-sm" />
                                    <span className="composer-upload-active-fname" title={name}>
                                        {name}
                                    </span>
                                    <span className="composer-upload-active-bar" aria-hidden>
                                        <span className="composer-upload-active-bar-fill" />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="composer-bottom">
                    {models.length > 0 && onModelChange && (
                        <ModelSelector
                            models={models}
                            selectedModel={selectedModel}
                            onModelChange={onModelChange}
                            disabled={disabled}
                            renderTrigger={(open, _isOpen, label) => (
                                <button
                                    type="button"
                                    className="cmp-btn"
                                    onClick={open}
                                    disabled={disabled}
                                    title="모델 선택"
                                >
                                    {label} ▾
                                </button>
                            )}
                        />
                    )}

                    <span className="cmp-divider" />

                    <Tooltip
                        title={isReasoningModel ? '추론 모델에서는 사용할 수 없음' : '깊이 있는 분석'}
                        arrow
                    >
                        <span>
                            <button
                                type="button"
                                className={'cmp-btn' + (!isReasoningModel && thinkingMode ? ' on' : '')}
                                onClick={() => !isReasoningModel && setThinkingMode((v) => !v)}
                                disabled={disabled || isReasoningModel}
                            >
                                <IconBrain className="ic-sm" />
                                사고 모드
                            </button>
                        </span>
                    </Tooltip>

                    <Tooltip
                        title={isReasoningModel ? '추론 강도 설정' : '추론 모델(gpt-oss, Solar-Open2)에서만 사용 가능'}
                        arrow
                    >
                        <span>
                            <button
                                type="button"
                                className={'cmp-btn' + (reasoningEffort ? ' on' : '')}
                                onClick={(e) => isReasoningModel && setReasoningAnchor(e.currentTarget)}
                                disabled={disabled || !isReasoningModel}
                            >
                                <IconGauge className="ic-sm" />
                                {reasoningLabel}
                            </button>
                        </span>
                    </Tooltip>
                    <Popover
                        open={Boolean(reasoningAnchor)}
                        anchorEl={reasoningAnchor}
                        onClose={() => setReasoningAnchor(null)}
                        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                        PaperProps={{
                            sx: {
                                minWidth: 160,
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 'var(--r-md)',
                                boxShadow: 'var(--shadow-pop)',
                            },
                        }}
                    >
                        <MenuList dense>
                            {(['low', 'medium', 'high'] as const).map((level) => (
                                <MenuItem
                                    key={level}
                                    selected={effectiveEffort === level}
                                    onClick={() => {
                                        setReasoningEffort(level);
                                        setReasoningAnchor(null);
                                    }}
                                    sx={{ fontSize: 13, '&.Mui-selected': { bgcolor: 'var(--accent-soft)' } }}
                                >
                                    <ListItemText
                                        primaryTypographyProps={{
                                            fontWeight: effectiveEffort === level ? 600 : 400,
                                        }}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </ListItemText>
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Popover>

                    <span className="cmp-divider" />

                    <Tooltip
                        title={historyMode ? '이전 대화 맥락을 포함해 답변' : '이번 질문만 단독으로 답변'}
                        arrow
                    >
                        <button
                            type="button"
                            className={'cmp-btn' + (historyMode ? ' on' : '')}
                            onClick={() => setHistoryMode((v) => !v)}
                            disabled={disabled}
                        >
                            <IconHistory className="ic-sm" />
                            히스토리
                        </button>
                    </Tooltip>

                    <ToolSelector
                        disabled={disabled}
                        renderTrigger={(open) => (
                            <button
                                type="button"
                                className="cmp-btn ghost"
                                onClick={open}
                                disabled={disabled}
                                title="도구 설정"
                            >
                                <IconTool className="ic-sm" />
                                도구
                            </button>
                        )}
                    />

                    <span className="cmp-spacer" />

                    {isRunning && onCancel ? (
                        <button
                            type="button"
                            className="cmp-send cmp-stop"
                            onClick={onCancel}
                            aria-label="중단"
                            title="응답 중단"
                        >
                            <IconStop />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="cmp-send"
                            onClick={handleSend}
                            disabled={!canSend}
                            aria-label="보내기"
                            title="보내기 (Enter)"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                        </button>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </div>

            <div className="composer-hint">
                <span>분석 결과는 참고용입니다 · 실제 조치는 전문가 검토 후 진행하세요</span>
                <span>Enter 전송 · Shift+Enter 줄바꿈</span>
            </div>

            <Dialog
                open={uploadDialogOpen}
                onClose={handleCancelUploadDialog}
                maxWidth="sm"
                fullWidth
                // body에 padding-right를 주입해 컨텐츠가 좌측으로 튀는 현상 차단
                disableScrollLock
                PaperProps={{
                    sx: {
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 'var(--r-lg)',
                        boxShadow: 'var(--shadow-pop)',
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        fontSize: 15,
                        fontWeight: 600,
                        py: 1.75,
                        px: 2.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    파일 업로드
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>
                        — 파일 설명은 업로드 후 자동으로 생성됩니다
                    </span>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, px: 2.5 }}>
                    <div className="composer-upload-list">
                        {pendingFiles.map((file, idx) => (
                            <div className="composer-upload-row" key={`${file.name}-${idx}`}>
                                <div className="composer-upload-fileinfo">
                                    <IconFile className="ic-sm" />
                                    <span className="composer-upload-fname">{file.name}</span>
                                    <span className="composer-upload-fsize">
                                        {formatFileSize(file.size)}
                                    </span>
                                    <button
                                        type="button"
                                        className="composer-upload-remove"
                                        onClick={() => removePendingFile(idx)}
                                        aria-label="제외"
                                        title="이 파일은 업로드하지 않음"
                                    >
                                        <IconX className="ic-sm" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {pendingFiles.length === 0 && (
                            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                                업로드할 파일이 없습니다.
                            </div>
                        )}
                    </div>
                </DialogContent>
                <DialogActions
                    sx={{
                        px: 2.5,
                        py: 1.75,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        gap: 0.5,
                    }}
                >
                    <button
                        type="button"
                        className="cmp-btn"
                        onClick={handleCancelUploadDialog}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        className="cmp-btn"
                        onClick={handleConfirmUploadDialog}
                        disabled={pendingFiles.length === 0}
                        style={{
                            background: 'var(--accent)',
                            color: 'var(--accent-ink)',
                            fontWeight: 600,
                        }}
                    >
                        {pendingFiles.length > 0
                            ? `업로드 (${pendingFiles.length}개)`
                            : '업로드'}
                    </button>
                </DialogActions>
            </Dialog>
        </div>
    );
});
