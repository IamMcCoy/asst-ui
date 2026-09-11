import { FC, useState, useEffect } from 'react';
import { Dialog } from '@mui/material';
import { IconX } from './icons';
import { adminService } from '../services/api';
import './Overlay.css';

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
            PaperProps={{ sx: { bgcolor: 'transparent', backgroundImage: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' } }}
        >
            <div className="ov-dlg">
                <div className="ov-head">
                    <div className="ov-head-text">
                        <span className="ov-title">운영 설정</span>
                        <span className="mono-label">ADMIN</span>
                    </div>
                    <span className="ov-head-spacer" />
                    <button type="button" className="ov-close" onClick={onClose} aria-label="닫기">
                        <IconX className="ic" />
                    </button>
                </div>

                <div className="ov-body">
                    {error && (
                        <div className="ov-alert error">
                            <span className="ov-alert-text">{error}</span>
                            <button type="button" className="ov-close" onClick={() => setError(null)} aria-label="닫기">
                                <IconX className="ic-sm" />
                            </button>
                        </div>
                    )}
                    {saved && !dirty && (
                        <div className="ov-alert success">
                            <span className="ov-alert-text">세션 상한을 {current}로 저장했습니다.</span>
                            <button type="button" className="ov-close" onClick={() => setSaved(false)} aria-label="닫기">
                                <IconX className="ic-sm" />
                            </button>
                        </div>
                    )}

                    <div className="ov-note">
                        <span className="mono-label">사용자당 세션 상한</span>
                        <span className="ov-note-text">
                            한 사용자가 동시에 가질 수 있는 세션 수. 재시작 시 기본값으로 리셋됩니다.
                        </span>
                    </div>

                    {loading ? (
                        <div className="ov-spin-center"><div className="ov-spin lg" /></div>
                    ) : (
                        <div className="ov-field">
                            <div className={'ov-input-wrap' + (draft !== '' && !valid ? ' invalid' : '')}>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
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
                                    aria-label="세션 상한"
                                />
                            </div>
                            <span className={'ov-hint' + (draft !== '' && !valid ? ' bad' : '')}>
                                {draft !== '' && !valid ? '1 이상의 정수여야 합니다.' : `현재 적용값: ${current ?? '-'}`}
                            </span>
                        </div>
                    )}
                </div>

                <div className="ov-foot">
                    <button type="button" className="ov-btn" onClick={onClose}>닫기</button>
                    <button
                        type="button"
                        className="ov-btn primary"
                        onClick={handleSave}
                        disabled={loading || saving || !valid || !dirty}
                    >
                        {saving ? <><div className="ov-spin" />저장 중…</> : '저장'}
                    </button>
                </div>
            </div>
        </Dialog>
    );
};
