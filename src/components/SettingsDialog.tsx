import { FC, useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    IconButton,
    Alert,
    CircularProgress,
    InputAdornment,
} from '@mui/material';
import { IconX, IconSave, IconEye, IconEyeOff } from './icons';
import { apiKeyService } from '../services/api';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    userId: string;
}

// IP 외부 인텔리전스 서비스 키 — 백엔드 키 이름 기준 (PUT keys 맵에 빈 문자열이면 삭제)
const SERVICES: { id: string; label: string }[] = [
    { id: 'whois', label: 'WHOIS' },
    { id: 'shodan', label: 'Shodan' },
    { id: 'virus_total', label: 'VirusTotal' },
    { id: 'ipinfo', label: 'IPinfo' },
    { id: 'ahnlab_tip', label: 'AhnLab TIP' },
    { id: 'abuseipdb', label: 'AbuseIPDB' },
];

const emptyKeys = () => Object.fromEntries(SERVICES.map((s) => [s.id, ''])) as Record<string, string>;

const fieldSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        bgcolor: 'rgba(63, 213, 186, 0.05)',
        '& fieldset': { borderColor: 'rgba(63, 213, 186, 0.2)' },
        '&:hover fieldset': { borderColor: 'rgba(63, 213, 186, 0.4)' },
        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
    },
};

export const SettingsDialog: FC<SettingsDialogProps> = ({ open, onClose, userId }) => {
    const [keys, setKeys] = useState<Record<string, string>>(emptyKeys);
    // 서버에 등록돼 있는 서비스 — "빈 값 저장 시 삭제" 안내용
    const [registered, setRegistered] = useState<Set<string>>(new Set());
    const [visible, setVisible] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (open) {
            loadApiKeys();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, userId]);

    const loadApiKeys = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiKeyService.getApiKeys(userId);
            // 응답: {keys: {shodan: "...", ...}} — 미등록 서비스는 키 없음
            const serverKeys: Record<string, string> = (response as any).keys || response || {};
            const next = emptyKeys();
            const reg = new Set<string>();
            SERVICES.forEach(({ id }) => {
                if (serverKeys[id]) {
                    next[id] = serverKeys[id];
                    reg.add(id);
                }
            });
            setKeys(next);
            setRegistered(reg);
        } catch (err) {
            console.error('[API Keys Load Error]', err);
            setKeys(emptyKeys());
            setRegistered(new Set());
            setError('API 키를 불러오는데 실패했습니다. 새로 입력해주세요.');
        } finally {
            setLoading(false);
            setVisible(new Set());
        }
    };

    const toggleVisible = (id: string) =>
        setVisible((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);
            // 6개 키를 한 번에 저장 — 빈 문자열은 해당 키 삭제
            const payload = Object.fromEntries(SERVICES.map(({ id }) => [id, keys[id].trim()]));
            await apiKeyService.saveApiKeys(userId, payload);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                loadApiKeys();
            }, 2000);
        } catch (err) {
            console.error('API 키 저장 실패:', err);
            setError('API 키 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (!saving) {
            setSuccess(false);
            setError(null);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    background: (theme) =>
                        theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(22, 29, 36, 0.98) 0%, rgba(14, 20, 25, 0.98) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 244, 238, 0.98) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(63, 213, 186, 0.2)',
                    borderRadius: '16px',
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pb: 2,
                    borderBottom: '1px solid rgba(63, 213, 186, 0.1)',
                }}
            >
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
                        외부 인텔리전스 연동
                    </Typography>
                    <Typography className="mono-label" sx={{ display: 'block', mt: 0.5 }}>
                        TI 소스 API 키
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleClose}
                    disabled={saving}
                    sx={{
                        color: 'text.secondary',
                        '&:hover': { bgcolor: 'rgba(63, 213, 186, 0.1)', color: 'primary.main' },
                    }}
                >
                    <IconX className="ic-lg" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={2.5}>
                        {error && (
                            <Alert
                                severity="error"
                                onClose={() => setError(null)}
                                sx={{
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                }}
                            >
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert
                                severity="success"
                                sx={{
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                }}
                            >
                                API 키가 성공적으로 저장되었습니다!
                            </Alert>
                        )}

                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
                                TI 소스 API 키
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                IP 분석에 사용하는 외부 위협 인텔리전스 소스의 API 키를 등록하세요. 등록된 키를 빈 값으로 저장하면 삭제됩니다.
                            </Typography>
                        </Box>

                        {SERVICES.map(({ id, label }) => (
                            <TextField
                                key={id}
                                label={`${label} API Key`}
                                type={visible.has(id) ? 'text' : 'password'}
                                value={keys[id]}
                                onChange={(e) => setKeys((prev) => ({ ...prev, [id]: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                autoComplete="off"
                                placeholder={`${label} API 키를 입력하세요`}
                                disabled={saving}
                                helperText={
                                    registered.has(id)
                                        ? keys[id].trim() ? '등록됨' : '빈 값으로 저장하면 이 키가 삭제됩니다'
                                        : ''
                                }
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={() => toggleVisible(id)}
                                                aria-label={visible.has(id) ? '키 숨기기' : '키 보기'}
                                                edge="end"
                                            >
                                                {visible.has(id) ? <IconEyeOff className="ic-sm" /> : <IconEye className="ic-sm" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={fieldSx}
                            />
                        ))}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid rgba(63, 213, 186, 0.1)' }}>
                <Button
                    onClick={handleClose}
                    disabled={saving}
                    sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.1)' } }}
                >
                    취소
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving || loading}
                    startIcon={saving ? <CircularProgress size={16} /> : <IconSave />}
                    sx={{
                        background: 'linear-gradient(135deg, #3FD5BA 0%, #1A8B7E 100%)',
                        boxShadow: '0 4px 14px 0 rgba(63, 213, 186, 0.4)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #5FE2C9 0%, #3FD5BA 100%)',
                            boxShadow: '0 6px 20px 0 rgba(63, 213, 186, 0.6)',
                        },
                        '&:disabled': { background: 'rgba(63, 213, 186, 0.3)', color: 'rgba(255, 255, 255, 0.5)' },
                    }}
                >
                    {saving ? '저장 중...' : '저장'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
