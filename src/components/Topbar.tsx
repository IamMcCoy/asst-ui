import { FC, KeyboardEvent, useState } from 'react';
import { Tooltip } from '@mui/material';
import { IconEdit, IconTrash, IconStar, IconStarFilled, IconCheck, IconX } from './icons';
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

// 시안의 Header — 모노 브레드크럼(SAUS / 제목 / SESSION 배지) + 모델 표시 + 텍스트 버튼 + 테마 토글
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

    const startRename = () => {
        setDraft(sessionTitle ?? '');
        setEditing(true);
    };
    const commitRename = () => {
        const next = draft.trim();
        if (sessionId && next && next !== sessionTitle) onRenameSession?.(sessionId, next);
        setEditing(false);
    };
    const cancelRename = () => {
        setEditing(false);
        setDraft('');
    };
    const handleEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
    };

    return (
        <header className="topbar">
            <div className="topbar-crumbs">
                <span>SAUS</span>
                <span className="sep">/</span>
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
                {sessionId && (
                    <span className="topbar-session">SESSION {sessionId.slice(0, 8)}</span>
                )}
                {sessionId && !editing && (
                    <span className="topbar-title-actions">
                        {onToggleFavorite && (
                            <Tooltip title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'} arrow>
                                <button
                                    type="button"
                                    className={'topbar-icon-btn' + (isFavorite ? ' is-on' : '')}
                                    onClick={() => onToggleFavorite(sessionId)}
                                    aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                                >
                                    {isFavorite ? <IconStarFilled className="ic-sm" /> : <IconStar className="ic-sm" />}
                                </button>
                            </Tooltip>
                        )}
                        {onRenameSession && (
                            <Tooltip title="제목 수정" arrow>
                                <button type="button" className="topbar-icon-btn" onClick={startRename} aria-label="제목 수정">
                                    <IconEdit className="ic-sm" />
                                </button>
                            </Tooltip>
                        )}
                        {onDeleteSession && (
                            <Tooltip title="세션 삭제" arrow>
                                <button type="button" className="topbar-icon-btn danger" onClick={() => onDeleteSession(sessionId)} aria-label="세션 삭제">
                                    <IconTrash className="ic-sm" />
                                </button>
                            </Tooltip>
                        )}
                    </span>
                )}
            </div>

            <div className="topbar-right">
                {modelName && (
                    <span className="topbar-model" title="현재 모델">
                        <span className="dot-live" />
                        {modelName}
                    </span>
                )}
                {isAdmin && onOpenAdmin && (
                    <button type="button" className="topbar-link" onClick={onOpenAdmin}>관리자</button>
                )}
                {isAdmin && onOpenAdminSettings && (
                    <button type="button" className="topbar-link" onClick={onOpenAdminSettings}>운영 설정</button>
                )}
                {onOpenSettings && (
                    <button type="button" className="topbar-link" onClick={onOpenSettings} title="외부 인텔리전스 API 키">TI 연동</button>
                )}
                <button
                    type="button"
                    className="topbar-theme"
                    onClick={onToggleMode}
                    aria-label="테마 전환"
                    title={mode === 'dark' ? '라이트 모드' : '다크 모드'}
                >
                    <span />
                </button>
            </div>
        </header>
    );
};
