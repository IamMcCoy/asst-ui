import { FC, useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Paper,
    Chip,
    Tooltip,
    Typography,
    Popover,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
} from '@mui/material';
import {
    ArrowUpward as SendIcon,
    Psychology as ThinkingIcon,
    InfoOutlined as InfoIcon,
    Speed as SpeedIcon,
    AttachFile as AttachFileIcon,
    InsertDriveFile as FileIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { ToolSelector } from './ToolSelector';
import { ModelSelector } from './ModelSelector';
import { SessionFiles } from './SessionFiles';
import { fileService } from '../services/api';
import { UploadedFile } from '../types/api';

interface MessageInputProps {
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
}

export const MessageInput: FC<MessageInputProps> = ({
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
                                                    }) => {
    const [message, setMessage] = useState('');
    const [thinkingMode, setThinkingMode] = useState(false);
    const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);
    const [reasoningAnchorEl, setReasoningAnchorEl] = useState<HTMLElement | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
    const [uploadingNames, setUploadingNames] = useState<string[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [pendingFiles, setPendingFiles] = useState<{ file: File; description: string }[]>([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const isGptOss = selectedModel?.toLowerCase().includes('gpt-oss') ?? false;
    const isUploading = uploadingNames.length > 0;

    // 세션 변경 시 첨부 목록 초기화
    useEffect(() => {
        setAttachedFiles([]);
        setUploadingNames([]);
        setUploadError(null);
        setPendingFiles([]);
        setUploadDialogOpen(false);
    }, [sessionId]);

    const handleAttachClick = () => {
        if (!sessionId || disabled || isUploading) return;
        fileInputRef.current?.click();
    };

    // 파일 선택 → 설명 입력 다이얼로그 오픈
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        // 동일 파일 재선택 가능하도록 즉시 input 초기화
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!sessionId || files.length === 0) return;

        setPendingFiles(files.map((f) => ({ file: f, description: '' })));
        setUploadDialogOpen(true);
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
        setUploadError(null);
        setUploadingNames((prev) => [...prev, ...toUpload.map((p) => p.file.name)]);

        await Promise.all(
            toUpload.map(async ({ file, description }) => {
                try {
                    const uploaded = await fileService.uploadFile(userId, sessionId, file, description);
                    if (uploaded.file_id) {
                        setAttachedFiles((prev) => [...prev, uploaded]);
                        onFilesChanged?.();
                    } else {
                        setUploadError(`${file.name}: 업로드 응답에 file_id가 없습니다.`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : '업로드 실패';
                    setUploadError(`${file.name}: ${msg}`);
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

    const handleRemoveAttached = async (file: UploadedFile) => {
        if (!sessionId || !file.file_id) return;
        // 낙관적 제거
        setAttachedFiles((prev) => prev.filter((f) => f.file_id !== file.file_id));
        try {
            await fileService.deleteFile(userId, sessionId, file.file_id);
            onFilesChanged?.();
        } catch (err) {
            console.warn('파일 삭제 실패 (로컬 상태에서만 제거됨):', err);
        }
    };

    const handleSend = () => {
        if (message.trim() && !disabled && !isUploading) {
            onSendMessage(message.trim(), {
                thinkingMode: isGptOss ? false : thinkingMode,
                selectedModel,
                reasoningEffort: isGptOss ? reasoningEffort : null,
                fileIds: attachedFiles.map((f) => f.file_id).filter(Boolean),
            });
            setMessage('');
            setAttachedFiles([]);
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);
    };

    return (
        <Box>
            <Paper
                elevation={0}
                sx={{
                    background: 'linear-gradient(135deg, rgba(63, 213, 186, 0.05) 0%, rgba(224, 115, 101, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(63, 213, 186, 0.1)',
                    borderRadius: '20px',
                }}
            >
                <Box p={2}>
                    <Box display="flex" gap={1} mb={2} flexWrap="wrap" alignItems="center">
                        <ModelSelector
                            models={models}
                            selectedModel={selectedModel ?? null}
                            onModelChange={(model) => onModelChange?.(model)}
                            disabled={disabled}
                        />
                        <Tooltip title={isGptOss ? 'gpt-oss 모델에서는 사용할 수 없습니다' : '깊이 있는 분석을 제공합니다'} arrow>
                            <span>
                                <Chip
                                    icon={<ThinkingIcon />}
                                    label="사고 모드"
                                    onClick={() => !isGptOss && setThinkingMode(!thinkingMode)}
                                    disabled={disabled || isGptOss}
                                    color={(!isGptOss && thinkingMode ? 'primary' : 'default') as 'primary' | 'default'}
                                    variant={(!isGptOss && thinkingMode ? 'filled' : 'outlined') as 'filled' | 'outlined'}
                                    sx={{
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: isGptOss ? 'none' : 'translateY(-2px)',
                                        },
                                    }}
                                />
                            </span>
                        </Tooltip>
                        <Tooltip title={isGptOss ? '추론 강도를 설정합니다' : 'gpt-oss 모델에서만 사용 가능합니다'} arrow>
                            <span>
                                <Chip
                                    icon={<SpeedIcon />}
                                    label={reasoningEffort ? `추론: ${reasoningEffort}` : '추론 강도'}
                                    onClick={(e) => setReasoningAnchorEl(e.currentTarget)}
                                    disabled={disabled || !isGptOss}
                                    color={reasoningEffort ? 'secondary' : 'default'}
                                    variant={reasoningEffort ? 'filled' : 'outlined'}
                                    sx={{
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                        },
                                    }}
                                />
                            </span>
                        </Tooltip>
                        <Popover
                            open={Boolean(reasoningAnchorEl)}
                            anchorEl={reasoningAnchorEl}
                            onClose={() => setReasoningAnchorEl(null)}
                            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                            PaperProps={{
                                sx: {
                                    minWidth: 160,
                                    bgcolor: (theme) =>
                                        theme.palette.mode === 'dark'
                                            ? 'rgba(22, 29, 36, 0.95)'
                                            : 'rgba(255, 255, 255, 0.98)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(63, 213, 186, 0.2)',
                                    borderRadius: '12px',
                                },
                            }}
                        >
                            <Box p={1.5} pb={0.5}>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ px: 0.5 }}>
                                    추론 강도
                                </Typography>
                            </Box>
                            <List dense sx={{ pt: 0, pb: 1 }}>
                                {(['low', 'medium', 'high'] as const).map((level) => (
                                    <ListItem
                                        key={level}
                                        onClick={() => {
                                            setReasoningEffort(reasoningEffort === level ? null : level);
                                            setReasoningAnchorEl(null);
                                        }}
                                        sx={{
                                            px: 2,
                                            py: 0.5,
                                            cursor: 'pointer',
                                            bgcolor: reasoningEffort === level
                                                ? 'rgba(63, 213, 186, 0.15)'
                                                : 'transparent',
                                            '&:hover': {
                                                bgcolor: 'rgba(63, 213, 186, 0.08)',
                                            },
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={reasoningEffort === level ? 600 : 400}
                                                    sx={{
                                                        color: reasoningEffort === level
                                                            ? 'primary.main'
                                                            : 'text.primary',
                                                    }}
                                                >
                                                    {level === 'low' ? 'Low' : level === 'medium' ? 'Medium' : 'High'}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Popover>
                        <ToolSelector disabled={disabled} />
                    </Box>

                    {onDeleteSessionFile && (
                        <SessionFiles files={sessionFiles} onDelete={onDeleteSessionFile} />
                    )}

                    {(attachedFiles.length > 0 || uploadingNames.length > 0 || uploadError) && (
                        <Box display="flex" flexWrap="wrap" gap={1} mb={1.5}>
                            {attachedFiles.map((file) => (
                                <Chip
                                    key={file.file_id}
                                    icon={<FileIcon />}
                                    label={file.filename || file.file_id}
                                    onDelete={() => handleRemoveAttached(file)}
                                    deleteIcon={<CloseIcon />}
                                    disabled={disabled}
                                    sx={{
                                        bgcolor: 'rgba(63, 213, 186, 0.12)',
                                        border: '1px solid rgba(63, 213, 186, 0.3)',
                                    }}
                                />
                            ))}
                            {uploadingNames.map((name) => (
                                <Chip
                                    key={`uploading-${name}`}
                                    icon={<CircularProgress size={14} sx={{ color: 'inherit' }} />}
                                    label={`업로드 중: ${name}`}
                                    disabled
                                    sx={{
                                        bgcolor: 'rgba(63, 213, 186, 0.05)',
                                        border: '1px dashed rgba(63, 213, 186, 0.3)',
                                    }}
                                />
                            ))}
                            {uploadError && (
                                <Chip
                                    label={uploadError}
                                    onDelete={() => setUploadError(null)}
                                    color="error"
                                    variant="outlined"
                                />
                            )}
                        </Box>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />

                    <Box display="flex" gap={1} alignItems="flex-end">
                        <Tooltip
                            title={
                                !sessionId
                                    ? '세션이 생성된 후 파일을 첨부할 수 있습니다'
                                    : isUploading
                                    ? '업로드 진행 중'
                                    : '파일 첨부'
                            }
                            arrow
                        >
                            <span>
                                <IconButton
                                    onClick={handleAttachClick}
                                    disabled={disabled || !sessionId || isUploading}
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        color: 'text.secondary',
                                        bgcolor: 'rgba(63, 213, 186, 0.08)',
                                        border: '1px solid rgba(63, 213, 186, 0.2)',
                                        '&:hover': {
                                            bgcolor: 'rgba(63, 213, 186, 0.15)',
                                            color: 'primary.main',
                                            transform: 'translateY(-2px)',
                                        },
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {isUploading ? <CircularProgress size={20} /> : <AttachFileIcon />}
                                </IconButton>
                            </span>
                        </Tooltip>
                        <TextField
                            value={message}
                            onChange={handleChange}
                            onKeyPress={handleKeyPress}
                            placeholder="메시지를 입력하세요..."
                            multiline
                            maxRows={4}
                            fullWidth
                            disabled={disabled}
                            variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '14px',
                                    bgcolor: (theme) =>
                                        theme.palette.mode === 'dark'
                                            ? 'rgba(22, 29, 36, 0.5)'
                                            : 'rgba(255, 255, 255, 0.7)',
                                    '& fieldset': {
                                        borderColor: 'rgba(63, 213, 186, 0.2)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'rgba(63, 213, 186, 0.4)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'primary.main',
                                    },
                                },
                            }}
                        />
                        <IconButton
                            onClick={handleSend}
                            disabled={!message.trim() || disabled || isUploading}
                            sx={{
                                background: !message.trim() || disabled
                                    ? 'rgba(63, 213, 186, 0.2)'
                                    : 'linear-gradient(135deg, #3FD5BA 0%, #1A8B7E 100%)',
                                color: 'white',
                                width: 48,
                                height: 48,
                                boxShadow: !message.trim() || disabled
                                    ? 'none'
                                    : '0 4px 14px 0 rgba(63, 213, 186, 0.4)',
                                '&:hover': {
                                    background: !message.trim() || disabled
                                        ? 'rgba(63, 213, 186, 0.2)'
                                        : 'linear-gradient(135deg, #5FE2C9 0%, #3FD5BA 100%)',
                                    transform: !message.trim() || disabled ? 'none' : 'translateY(-2px)',
                                    boxShadow: !message.trim() || disabled
                                        ? 'none'
                                        : '0 6px 20px 0 rgba(63, 213, 186, 0.6)',
                                },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <SendIcon />
                        </IconButton>
                    </Box>
                </Box>
            </Paper>

            {/* Disclaimer Message */}
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={0.5}
                mt={1.5}
                px={2}
            >
                <InfoIcon
                    sx={{
                        fontSize: 14,
                        color: 'text.secondary',
                        opacity: 0.6,
                    }}
                />
                <Typography
                    variant="caption"
                    sx={{
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        opacity: 0.8,
                        textAlign: 'center',
                    }}
                >
                    제공되는 분석 결과는 참고 자료로 활용해 주세요. 실제 보안 조치는 전문가와 상의해 주세요.
                </Typography>
            </Box>

            {/* 파일 업로드 — 설명 입력 다이얼로그 */}
            <Dialog
                open={uploadDialogOpen}
                onClose={handleCancelUploadDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        background: (theme) =>
                            theme.palette.mode === 'dark'
                                ? 'linear-gradient(135deg, rgba(22, 29, 36, 0.98) 0%, rgba(14, 20, 25, 0.98) 100%)'
                                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 244, 238, 0.98) 100%)',
                        border: '1px solid rgba(63, 213, 186, 0.2)',
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>파일 업로드</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        각 파일에 설명을 추가할 수 있습니다 (선택). 비워두고 업로드해도 됩니다.
                    </Typography>
                    <Stack spacing={2}>
                        {pendingFiles.map((p, idx) => (
                            <Paper
                                key={`${p.file.name}-${idx}`}
                                variant="outlined"
                                sx={{ p: 1.5, bgcolor: 'rgba(63, 213, 186, 0.04)' }}
                            >
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <FileIcon fontSize="small" color="primary" />
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            flex: 1,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {p.file.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {(p.file.size / 1024).toFixed(1)} KB
                                    </Typography>
                                    <Tooltip title="이 파일 제외" arrow>
                                        <IconButton size="small" onClick={() => removePendingFile(idx)}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="설명 (선택)"
                                    value={p.description}
                                    onChange={(e) => updatePendingDescription(idx, e.target.value)}
                                    multiline
                                    maxRows={3}
                                />
                            </Paper>
                        ))}
                        {pendingFiles.length === 0 && (
                            <Typography variant="body2" color="text.secondary" align="center">
                                업로드할 파일이 없습니다.
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelUploadDialog}>취소</Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmUploadDialog}
                        disabled={pendingFiles.length === 0}
                    >
                        업로드 ({pendingFiles.length})
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};