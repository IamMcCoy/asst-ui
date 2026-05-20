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
import {
    IconPaperclip,
    IconSend,
    IconStop,
    IconBrain,
    IconGauge,
    IconTool,
    IconChevronDown,
    IconSparkle,
    IconInfo,
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
}, ref) {
    const [message, setMessage] = useState('');
    const [thinkingMode, setThinkingMode] = useState(false);
    const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);
    const [reasoningAnchor, setReasoningAnchor] = useState<HTMLElement | null>(null);
    const [uploadingNames, setUploadingNames] = useState<string[]>([]);
    const [pendingFiles, setPendingFiles] = useState<{ file: File; description: string }[]>([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const isGptOss = selectedModel?.toLowerCase().includes('gpt-oss') ?? false;
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
        const next = Math.min(Math.max(el.scrollHeight, 48), 220);
        el.style.height = next + 'px';
        el.style.overflowY = el.scrollHeight > 220 ? 'auto' : 'hidden';
    }, [message]);

    const handleSend = () => {
        if (!canSend) return;
        onSendMessage(message.trim(), {
            thinkingMode: isGptOss ? false : thinkingMode,
            selectedModel,
            reasoningEffort: isGptOss ? reasoningEffort : null,
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
        setPendingFiles(files.map((f) => ({ file: f, description: '' })));
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


    const updatePendingDescription = (idx: number, value: string) => {
        setPendingFiles((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], description: value };
            return next;
        });
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
        setUploadingNames((prev) => [...prev, ...toUpload.map((p) => p.file.name)]);

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
            toUpload.map(async ({ file, description }): Promise<UploadOutcome> => {
                try {
                    const uploaded = await fileService.uploadFile(userId, sessionId, file, description);
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

    // 파일 크기 표기 — 1MB 이상은 MB(소수 2자리), 미만은 KB(소수 1자리)
    const formatFileSize = (bytes: number): string => {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
        const MB = 1024 * 1024;
        if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    const reasoningLabel =
        reasoningEffort
            ? `추론: ${reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1)}`
            : '추론 강도';

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
                        placeholder="무엇이든 물어보세요 — IP 분석, CTI 조회, 파일 요약…"
                        disabled={disabled}
                        rows={1}
                    />
                </div>

                {onDeleteSessionFile && sessionFiles.length > 0 && (
                    <div style={{ padding: '0 12px' }}>
                        <SessionFiles files={sessionFiles} onDelete={onDeleteSessionFile} />
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
                                    <IconSparkle className="ic-sm" />
                                    {label}
                                    <IconChevronDown className="ic-sm" />
                                </button>
                            )}
                        />
                    )}

                    <span className="cmp-divider" />

                    <Tooltip
                        title={isGptOss ? 'gpt-oss 모델에서는 사용할 수 없음' : '깊이 있는 분석'}
                        arrow
                    >
                        <span>
                            <button
                                type="button"
                                className={'cmp-btn' + (!isGptOss && thinkingMode ? ' on' : '')}
                                onClick={() => !isGptOss && setThinkingMode((v) => !v)}
                                disabled={disabled || isGptOss}
                            >
                                <IconBrain className="ic-sm" />
                                사고 모드
                            </button>
                        </span>
                    </Tooltip>

                    <Tooltip
                        title={isGptOss ? '추론 강도 설정' : 'gpt-oss 모델에서만 사용 가능'}
                        arrow
                    >
                        <span>
                            <button
                                type="button"
                                className={'cmp-btn' + (reasoningEffort ? ' on' : '')}
                                onClick={(e) => isGptOss && setReasoningAnchor(e.currentTarget)}
                                disabled={disabled || !isGptOss}
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
                                    selected={reasoningEffort === level}
                                    onClick={() => {
                                        setReasoningEffort(reasoningEffort === level ? null : level);
                                        setReasoningAnchor(null);
                                    }}
                                    sx={{ fontSize: 13, '&.Mui-selected': { bgcolor: 'var(--accent-soft)' } }}
                                >
                                    <ListItemText
                                        primaryTypographyProps={{
                                            fontWeight: reasoningEffort === level ? 600 : 400,
                                        }}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </ListItemText>
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Popover>

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
                                도구 설정
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
                            <IconSend />
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
                <IconInfo className="ic" />
                분석 결과는 참고용입니다. 실제 보안 조치는 전문가와 상의해 주세요.
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
                        — 각 파일에 설명을 붙여두면 검색·분석 시 도움이 됩니다
                    </span>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, px: 2.5 }}>
                    <div className="composer-upload-list">
                        {pendingFiles.map((p, idx) => (
                            <div className="composer-upload-row" key={`${p.file.name}-${idx}`}>
                                <div className="composer-upload-fileinfo">
                                    <IconFile className="ic-sm" />
                                    <span className="composer-upload-fname">{p.file.name}</span>
                                    <span className="composer-upload-fsize">
                                        {formatFileSize(p.file.size)}
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
                                <input
                                    type="text"
                                    className="composer-upload-desc"
                                    placeholder="파일 설명 (선택) — 예: 보안 보고서 / Apache access log 일부 / IP 분석 결과"
                                    value={p.description}
                                    onChange={(e) => updatePendingDescription(idx, e.target.value)}
                                />
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
