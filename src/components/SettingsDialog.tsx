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
} from '@mui/material';
import {
    Close as CloseIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { apiKeyService } from '../services/api';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    userId: string;
}

export const SettingsDialog: FC<SettingsDialogProps> = ({ open, onClose, userId }) => {
    const [whoisKey, setWhoisKey] = useState('');
    const [shodanKey, setShodanKey] = useState('');
    const [virusTotalKey, setVirusTotalKey] = useState('');
    const [hasWhoisKey, setHasWhoisKey] = useState(false);
    const [hasShodanKey, setHasShodanKey] = useState(false);
    const [hasVirusTotalKey, setHasVirusTotalKey] = useState(false);
    const [originalWhoisKey, setOriginalWhoisKey] = useState('');
    const [originalShodanKey, setOriginalShodanKey] = useState('');
    const [originalVirusTotalKey, setOriginalVirusTotalKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // API 키 불러오기
    useEffect(() => {
        if (open) {
            loadApiKeys();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, userId]);

    const maskApiKey = (key: string): string => {
        if (!key || key.length === 0) return '';
        if (key.length <= 8) return '*'.repeat(key.length);
        // 앞 4자리와 뒤 4자리만 보여주고 나머지는 마스킹
        return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
    };

    const loadApiKeys = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiKeyService.getApiKeys(userId);

            // API 응답 구조: {keys: {shodan: "...", virus_total: "...", whois: "..."}}
            const keys: Record<string, string> = (response as any).keys || response;

            // 원본 키 저장 및 마스킹 처리
            if (keys && keys.whois) {
                const masked = maskApiKey(keys.whois);
                setOriginalWhoisKey(keys.whois);
                setWhoisKey(masked);
                setHasWhoisKey(true);
            } else {
                setOriginalWhoisKey('');
                setWhoisKey('');
                setHasWhoisKey(false);
            }

            if (keys && keys.shodan) {
                const masked = maskApiKey(keys.shodan);
                setOriginalShodanKey(keys.shodan);
                setShodanKey(masked);
                setHasShodanKey(true);
            } else {
                setOriginalShodanKey('');
                setShodanKey('');
                setHasShodanKey(false);
            }

            if (keys && keys.virus_total) {
                const masked = maskApiKey(keys.virus_total);
                setOriginalVirusTotalKey(keys.virus_total);
                setVirusTotalKey(masked);
                setHasVirusTotalKey(true);
            } else {
                setOriginalVirusTotalKey('');
                setVirusTotalKey('');
                setHasVirusTotalKey(false);
            }
        } catch (err) {
            console.error('[API Keys Load Error]', err);
            // 에러가 발생해도 빈 값으로 초기화
            setOriginalWhoisKey('');
            setWhoisKey('');
            setHasWhoisKey(false);
            setOriginalShodanKey('');
            setShodanKey('');
            setHasShodanKey(false);
            setOriginalVirusTotalKey('');
            setVirusTotalKey('');
            setHasVirusTotalKey(false);

            // 에러 메시지는 표시하되, 사용자가 계속 입력할 수 있도록 함
            setError('API 키를 불러오는데 실패했습니다. 새로 입력해주세요.');
        } finally {
            setLoading(false);
        }
    };

    const handleFocus = (field: 'whois' | 'shodan' | 'virustotal') => {
        // 마스킹된 값이면 지우기
        if (field === 'whois' && hasWhoisKey && whoisKey.includes('*')) {
            setWhoisKey('');
        } else if (field === 'shodan' && hasShodanKey && shodanKey.includes('*')) {
            setShodanKey('');
        } else if (field === 'virustotal' && hasVirusTotalKey && virusTotalKey.includes('*')) {
            setVirusTotalKey('');
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            // 모든 키를 한 번에 저장 (API 명세에 따름)
            const keys: Record<string, string> = {};

            // whois 키 처리
            if (whoisKey.trim() && !whoisKey.includes('*')) {
                // 새로 입력한 값
                keys.whois = whoisKey.trim();
            } else if (whoisKey.includes('*')) {
                // 마스킹된 값 (변경 안 함) - 원본 키 사용
                keys.whois = originalWhoisKey;
            } else {
                // 빈 값 - 삭제
                keys.whois = '';
            }

            // shodan 키 처리
            if (shodanKey.trim() && !shodanKey.includes('*')) {
                // 새로 입력한 값
                keys.shodan = shodanKey.trim();
            } else if (shodanKey.includes('*')) {
                // 마스킹된 값 (변경 안 함) - 원본 키 사용
                keys.shodan = originalShodanKey;
            } else {
                // 빈 값 - 삭제
                keys.shodan = '';
            }

            // virus_total 키 처리
            if (virusTotalKey.trim() && !virusTotalKey.includes('*')) {
                // 새로 입력한 값
                keys.virus_total = virusTotalKey.trim();
            } else if (virusTotalKey.includes('*')) {
                // 마스킹된 값 (변경 안 함) - 원본 키 사용
                keys.virus_total = originalVirusTotalKey;
            } else {
                // 빈 값 - 삭제
                keys.virus_total = '';
            }

            await apiKeyService.saveApiKeys(userId, keys);
            setSuccess(true);

            // 2초 후 다시 로드하여 마스킹된 값 표시
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
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #3FD5BA 0%, #1A8B7E 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    설정
                </Typography>
                <IconButton
                    onClick={handleClose}
                    disabled={saving}
                    sx={{
                        color: 'text.secondary',
                        '&:hover': {
                            bgcolor: 'rgba(63, 213, 186, 0.1)',
                            color: 'primary.main',
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={3}>
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
                            <Typography
                                variant="subtitle2"
                                sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}
                            >
                                API 키 관리
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                                보안 분석에 필요한 외부 서비스의 API 키를 등록하세요.
                            </Typography>
                        </Box>

                        <TextField
                            label="WHOIS API Key"
                            value={whoisKey}
                            onChange={(e) => setWhoisKey(e.target.value)}
                            onFocus={() => handleFocus('whois')}
                            fullWidth
                            variant="outlined"
                            placeholder={hasWhoisKey ? "등록됨 - 수정하려면 클릭" : "WHOIS API 키를 입력하세요"}
                            disabled={saving}
                            helperText={hasWhoisKey && whoisKey.includes('*') ? "등록된 API 키가 있습니다" : ""}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(63, 213, 186, 0.05)',
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

                        <TextField
                            label="Shodan API Key"
                            value={shodanKey}
                            onChange={(e) => setShodanKey(e.target.value)}
                            onFocus={() => handleFocus('shodan')}
                            fullWidth
                            variant="outlined"
                            placeholder={hasShodanKey ? "등록됨 - 수정하려면 클릭" : "Shodan API 키를 입력하세요"}
                            disabled={saving}
                            helperText={hasShodanKey && shodanKey.includes('*') ? "등록된 API 키가 있습니다" : ""}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(63, 213, 186, 0.05)',
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

                        <TextField
                            label="VirusTotal API Key"
                            value={virusTotalKey}
                            onChange={(e) => setVirusTotalKey(e.target.value)}
                            onFocus={() => handleFocus('virustotal')}
                            fullWidth
                            variant="outlined"
                            placeholder={hasVirusTotalKey ? "등록됨 - 수정하려면 클릭" : "VirusTotal API 키를 입력하세요"}
                            disabled={saving}
                            helperText={hasVirusTotalKey && virusTotalKey.includes('*') ? "등록된 API 키가 있습니다" : ""}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(63, 213, 186, 0.05)',
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
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid rgba(63, 213, 186, 0.1)' }}>
                <Button
                    onClick={handleClose}
                    disabled={saving}
                    sx={{
                        color: 'text.secondary',
                        '&:hover': {
                            bgcolor: 'rgba(148, 163, 184, 0.1)',
                        },
                    }}
                >
                    취소
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving || loading}
                    startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                    sx={{
                        background: 'linear-gradient(135deg, #3FD5BA 0%, #1A8B7E 100%)',
                        boxShadow: '0 4px 14px 0 rgba(63, 213, 186, 0.4)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #5FE2C9 0%, #3FD5BA 100%)',
                            boxShadow: '0 6px 20px 0 rgba(63, 213, 186, 0.6)',
                        },
                        '&:disabled': {
                            background: 'rgba(63, 213, 186, 0.3)',
                            color: 'rgba(255, 255, 255, 0.5)',
                        },
                    }}
                >
                    {saving ? '저장 중...' : '저장'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
