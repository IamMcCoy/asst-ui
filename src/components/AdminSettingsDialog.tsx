import { FC, useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Button,
    TextField,
    Typography,
    IconButton,
    Alert,
    CircularProgress,
} from '@mui/material';
import { IconX } from './icons';
import { adminService } from '../services/api';

interface AdminSettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

export const AdminSettingsDialog: FC<AdminSettingsDialogProps> = ({ open, onClose }) => {
    const [current, setCurrent] = useState<number | null>(null); // 서버 반영값
    const [draft, setDraft] = useState('');                      // 입력 버퍼
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setSaved(false);
        setLoading(true);
        adminService
            .getMaxSessions()
            .then((v) => {
                setCurrent(v);
                setDraft(String(v));
            })
            .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
            .finally(() => setLoading(false));
    }, [open]);

    const parsed = parseInt(draft, 10);
    const valid = Number.isInteger(parsed) && parsed >= 1; // 백엔드 제약: ge=1
    const dirty = current != null && parsed !== current;

    const handleSave = async () => {
        if (!valid || !dirty) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const v = await adminService.setMaxSessions(parsed);
            setCurrent(v);
            setDraft(String(v));
            setSaved(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
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
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={700}>
                    관리자 — 운영 설정
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <IconX className="ic-lg" />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {error && (
                    <Alert severity="error" onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                {saved && !dirty && (
                    <Alert severity="success" onClose={() => setSaved(false)}>
                        세션 상한을 {current}로 저장했습니다.
                    </Alert>
                )}

                <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                        사용자당 세션 상한
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        한 사용자가 동시에 가질 수 있는 세션 수. 재시작 시 기본값으로 리셋됩니다.
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <TextField
                        type="number"
                        size="small"
                        label="세션 상한"
                        value={draft}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            setSaved(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                        inputProps={{ min: 1, step: 1 }}
                        error={draft !== '' && !valid}
                        helperText={draft !== '' && !valid ? '1 이상의 정수여야 합니다.' : `현재 적용값: ${current ?? '-'}`}
                        fullWidth
                    />
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>닫기</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading || saving || !valid || !dirty}
                    disableElevation
                >
                    {saving ? '저장 중…' : '저장'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
