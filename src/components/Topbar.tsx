import { FC, KeyboardEvent, useState } from 'react';
import { Tooltip } from '@mui/material';
import {
    IconShield,
    IconGauge,
    IconSun,
    IconMoon,
    IconSettings,
    IconEdit,
    IconTrash,
    IconStar,
    IconStarFilled,
    IconCheck,
    IconX,
} from './icons';
import './Topbar.css';

interface TopbarProps {
    sessionId?: string | null;
    sessionTitle?: string | null;
    modelName?: string | null;
    mode: 'light' | 'dark';
    onToggleMode: () => void;
    onOpenAdmin?: () => void;
    onOpenAdminSettings?: () => void;
    onOpenSettings?: () => void;
    isAdmin: boolean;
    onRenameSession?: (sessionId: string, title: string) => void;
    onDeleteSession?: (sessionId: string) => void;
    isFavorite?: boolean;
    onToggleFavorite?: (sessionId: string) => void;
}

export const Topbar: FC<TopbarProps> = ({
    sessionId,
    sessionTitle,
    modelName,
    mode,
    onToggleMode,
    onOpenAdmin,
    onOpenAdminSettings,
    onOpenSettings,
    isAdmin,
    onRenameSession,
    onDeleteSession,
    isFavorite = false,
    onToggleFavorite,
}) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const hasSession = !!sessionId;

    const startRename = () => {
        setDraft(sessionTitle ?? '');
        setEditing(true);
    };

    const commitRename = () => {
        const next = draft.trim();
        if (sessionId && next && next !== sessionTitle) {
            onRenameSession?.(sessionId, next);
        }
        setEditing(false);
    };

    const cancelRename = () => {
        setEditing(false);
        setDraft('');
    };

    const handleEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRename();
        }
    };

    const handleDelete = () => {
        if (sessionId) onDeleteSession?.(sessionId);
    };

    const handleToggleFavorite = () => {
        if (sessionId) onToggleFavorite?.(sessionId);
    };

    return (
        <div className="topbar">
            <div className="topbar-title">
                <span className="crumb">SAUS</span>
                {editing ? (
                    <span className="topbar-title-edit">
                        <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={handleEditKey}
                            onBlur={commitRename}
                            aria-label="세션 제목"
                        />
                        <button type="button" className="confirm" onMouseDown={(e) => e.preventDefault()} onClick={commitRename} aria-label="저장">
                            <IconCheck className="ic-sm" />
                        </button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={cancelRename} aria-label="취소">
                            <IconX className="ic-sm" />
                        </button>
                    </span>
                ) : (
                    <span className="crumb-current" title={sessionTitle ?? '새 대화'}>
                        {sessionTitle || '새 대화'}
                    </span>
                )}

                {hasSession && !editing && (
                    <span className="topbar-title-actions">
                        {onToggleFavorite && (
                            <Tooltip title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'} arrow>
                                <button
                                    type="button"
                                    className={'topbar-icon-btn' + (isFavorite ? ' is-on' : '')}
                                    onClick={handleToggleFavorite}
                                    aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                                >
                                    {isFavorite ? <IconStarFilled className="ic-sm" /> : <IconStar className="ic-sm" />}
                                </button>
                            </Tooltip>
                        )}
                        {onRenameSession && (
                            <Tooltip title="제목 수정" arrow>
                                <button
                                    type="button"
                                    className="topbar-icon-btn"
                                    onClick={startRename}
                                    aria-label="제목 수정"
                                >
                                    <IconEdit className="ic-sm" />
                                </button>
                            </Tooltip>
                        )}
                        {onDeleteSession && (
                            <Tooltip title="세션 삭제" arrow>
                                <button
                                    type="button"
                                    className="topbar-icon-btn danger"
                                    onClick={handleDelete}
                                    aria-label="세션 삭제"
                                >
                                    <IconTrash className="ic-sm" />
                                </button>
                            </Tooltip>
                        )}
                    </span>
                )}
            </div>

            <div className="topbar-spacer" />

            {modelName && (
                <div className="topbar-pill" title="현재 모델">
                    <span className="dot-live" />
                    {modelName}
                </div>
            )}

            {isAdmin && onOpenAdmin && (
                <Tooltip title="관리자 — 챗봇 이용 기록" arrow>
                    <button
                        type="button"
                        className="topbar-btn"
                        onClick={onOpenAdmin}
                        aria-label="관리자"
                    >
                        <IconShield />
                    </button>
                </Tooltip>
            )}

            {isAdmin && onOpenAdminSettings && (
                <Tooltip title="관리자 — 운영 설정" arrow>
                    <button
                        type="button"
                        className="topbar-btn"
                        onClick={onOpenAdminSettings}
                        aria-label="관리자 설정"
                    >
                        <IconGauge />
                    </button>
                </Tooltip>
            )}

            <Tooltip title={mode === 'dark' ? '라이트 모드' : '다크 모드'} arrow>
                <button
                    type="button"
                    className="topbar-btn"
                    onClick={onToggleMode}
                    aria-label="테마 전환"
                >
                    {mode === 'dark' ? <IconSun /> : <IconMoon />}
                </button>
            </Tooltip>

            {onOpenSettings && (
                <Tooltip title="설정" arrow>
                    <button
                        type="button"
                        className="topbar-btn"
                        onClick={onOpenSettings}
                        aria-label="설정"
                    >
                        <IconSettings />
                    </button>
                </Tooltip>
            )}
        </div>
    );
};
