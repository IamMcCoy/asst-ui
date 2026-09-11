import { FC, useState, useEffect } from 'react';
import { Dialog } from '@mui/material';
import { IconX, IconSave, IconEye, IconEyeOff } from './icons';
import { apiKeyService } from '../services/api';
import './Overlay.css';

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
            // Paper는 모달 껍데기 — 보이는 것은 .ov-dlg가 그린다
            PaperProps={{ sx: { bgcolor: 'transparent', backgroundImage: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' } }}
        >
            <div className="ov-dlg">
                <div className="ov-head">
                    <div className="ov-head-text">
                        <span className="ov-title">외부 인텔리전스 연동</span>
                        <span className="mono-label">TI 소스 API 키</span>
                    </div>
                    <span className="ov-head-spacer" />
                    <button type="button" className="ov-close" onClick={handleClose} disabled={saving} aria-label="닫기">
                        <IconX className="ic" />
                    </button>
                </div>

                <div className="ov-body" style={{ maxHeight: '65vh' }}>
                    {error && (
                        <div className="ov-alert error">
                            <span className="ov-alert-text">{error}</span>
                            <button type="button" className="ov-close" onClick={() => setError(null)} aria-label="닫기">
                                <IconX className="ic-sm" />
                            </button>
                        </div>
                    )}
                    {success && (
                        <div className="ov-alert success">
                            <span className="ov-alert-text">API 키가 저장되었습니다.</span>
                        </div>
                    )}

                    <div className="ov-note">
                        <span className="ov-note-text">
                            IP 분석에 사용하는 외부 위협 인텔리전스 소스의 API 키를 등록하세요.
                            등록된 키를 빈 값으로 저장하면 삭제됩니다.
                        </span>
                    </div>

                    {loading ? (
                        <div className="ov-spin-center"><div className="ov-spin lg" /></div>
                    ) : (
                        SERVICES.map(({ id, label }) => {
                            const filled = keys[id].trim().length > 0;
                            return (
                                <div className="ov-field" key={id}>
                                    <div className="ov-field-label">
                                        <span className="mono-label">{label}</span>
                                        {registered.has(id) && (
                                            <span className={'ov-hint ' + (filled ? 'ok' : 'warn')}>
                                                {filled ? '등록됨' : '빈 값으로 저장하면 삭제됩니다'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="ov-input-wrap">
                                        <input
                                            type={visible.has(id) ? 'text' : 'password'}
                                            value={keys[id]}
                                            onChange={(e) => setKeys((prev) => ({ ...prev, [id]: e.target.value }))}
                                            placeholder={`${label} API 키`}
                                            autoComplete="off"
                                            disabled={saving}
                                            aria-label={`${label} API Key`}
                                        />
                                        <button
                                            type="button"
                                            className="ov-input-btn"
                                            onClick={() => toggleVisible(id)}
                                            aria-label={visible.has(id) ? '키 숨기기' : '키 보기'}
                                            title={visible.has(id) ? '숨기기' : '보기'}
                                        >
                                            {visible.has(id) ? <IconEyeOff className="ic-sm" /> : <IconEye className="ic-sm" />}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="ov-foot">
                    <button type="button" className="ov-btn" onClick={handleClose} disabled={saving}>
                        취소
                    </button>
                    <button type="button" className="ov-btn primary" onClick={handleSave} disabled={saving || loading}>
                        {saving ? <><div className="ov-spin" />저장 중…</> : <><IconSave className="ic-sm" />저장</>}
                    </button>
                </div>
            </div>
        </Dialog>
    );
};
