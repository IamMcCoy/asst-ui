import { FC, useState, KeyboardEvent, MouseEvent } from 'react';
import { Tooltip } from '@mui/material';
import { Session } from '../types/api';
import {
    IconMenu,
    IconPlus,
    IconHistory,
    IconEdit,
    IconTrash,
    IconCheck,
    IconX,
    IconStar,
    IconStarFilled,
} from './icons';
import './SessionSidebar.css';

interface SessionSidebarProps {
    sessions: Session[];
    currentSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onCreateSession: () => void;
    onDeleteSession: (sessionId: string) => void;
    onUpdateTitle: (sessionId: string, title: string) => void;
    userId: string;
    // sessionId → task_id (진행 중인 세션을 시각적으로 표시)
    activeTaskMap?: Record<string, string>;
    // 즐겨찾기 (localStorage 기반)
    isFavorite?: (sessionId: string) => boolean;
    onToggleFavorite?: (sessionId: string) => void;
}

// 세션 업데이트 시각을 "오늘/어제/M/D/YYYY/M/D" 형식으로 압축 표시
const formatRelativeDate = (iso?: string): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
    if (dayDiff === 0) return '오늘';
    if (dayDiff === 1) return '어제';
    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

export const SessionSidebar: FC<SessionSidebarProps> = ({
    sessions,
    currentSessionId,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    onUpdateTitle,
    userId,
    activeTaskMap = {},
    isFavorite,
    onToggleFavorite,
}) => {
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [collapsed, setCollapsed] = useState(false);

    const handleStartEdit = (e: MouseEvent, session: Session) => {
        e.stopPropagation();
        setEditingSessionId(session.session_id);
        setEditTitle(session.title ?? '');
    };

    const handleSaveEdit = (sessionId: string) => {
        const next = editTitle.trim();
        if (next) {
            onUpdateTitle(sessionId, next);
        }
        setEditingSessionId(null);
        setEditTitle('');
    };

    const handleCancelEdit = () => {
        setEditingSessionId(null);
        setEditTitle('');
    };

    const handleEditKey = (e: KeyboardEvent<HTMLInputElement>, sessionId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveEdit(sessionId);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    const handleDelete = (e: MouseEvent, sessionId: string) => {
        e.stopPropagation();
        onDeleteSession(sessionId);
    };

    const handleToggleFavorite = (e: MouseEvent, sessionId: string) => {
        e.stopPropagation();
        onToggleFavorite?.(sessionId);
    };

    const userInitial = (userId || 'U').trim().charAt(0).toUpperCase() || 'U';

    // 즐겨찾기/일반 세션 분리 — 즐겨찾기는 원래 정렬 유지
    const favoriteSessions = isFavorite
        ? sessions.filter((s) => isFavorite(s.session_id))
        : [];
    const regularSessions = isFavorite
        ? sessions.filter((s) => !isFavorite(s.session_id))
        : sessions;

    const renderSession = (session: Session) => {
        const isActive = currentSessionId === session.session_id;
        const isEditing = editingSessionId === session.session_id;
        const isRunning =
            !!activeTaskMap[session.session_id] || !!session.active_task_id;
        const favored = isFavorite ? isFavorite(session.session_id) : false;

        if (isEditing) {
            return (
                <div className="sb-item-edit" key={session.session_id}>
                    <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleEditKey(e, session.session_id)}
                    />
                    <button
                        type="button"
                        className="confirm"
                        onClick={() => handleSaveEdit(session.session_id)}
                        aria-label="저장"
                    >
                        <IconCheck className="ic-sm" />
                    </button>
                    <button type="button" onClick={handleCancelEdit} aria-label="취소">
                        <IconX className="ic-sm" />
                    </button>
                </div>
            );
        }

        const handleItemKey = (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectSession(session.session_id);
            }
        };

        const item = (
            <div
                key={session.session_id}
                role="button"
                tabIndex={0}
                className={'sb-item' + (isActive ? ' active' : '')}
                onClick={() => onSelectSession(session.session_id)}
                onKeyDown={handleItemKey}
                title={session.title ?? '제목 없음'}
            >
                {collapsed ? (
                    <>
                        {favored ? <IconStarFilled className="ic-sm sb-star" /> : <IconHistory className="ic-sm" />}
                        {isRunning && <span className="sb-dot" aria-label="답변 중" />}
                    </>
                ) : (
                    <>
                        <span className="title">
                            <span className="title-text">{session.title || '제목 없음'}</span>
                            {isRunning && (
                                <span className="sb-dot" aria-label="답변 중" title="답변 중" />
                            )}
                        </span>
                        <span className="actions">
                            {onToggleFavorite && (
                                <button
                                    type="button"
                                    className={favored ? 'fav active' : 'fav'}
                                    onClick={(e) => handleToggleFavorite(e, session.session_id)}
                                    aria-label={favored ? '즐겨찾기 해제' : '즐겨찾기'}
                                >
                                    {favored ? <IconStarFilled className="ic-sm" /> : <IconStar className="ic-sm" />}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={(e) => handleStartEdit(e, session)}
                                aria-label="이름 변경"
                            >
                                <IconEdit className="ic-sm" />
                            </button>
                            <button
                                type="button"
                                className="danger"
                                onClick={(e) => handleDelete(e, session.session_id)}
                                aria-label="삭제"
                            >
                                <IconTrash className="ic-sm" />
                            </button>
                        </span>
                        <span className="date">
                            {formatRelativeDate(session.metadata?.updated_at)}
                        </span>
                    </>
                )}
            </div>
        );

        if (collapsed) {
            return (
                <Tooltip
                    key={session.session_id}
                    title={session.title ?? '제목 없음'}
                    arrow
                    placement="right"
                >
                    {item}
                </Tooltip>
            );
        }
        return item;
    };

    return (
        <aside className={'sb' + (collapsed ? ' collapsed' : '')}>
            <div className="sb-head">
                {!collapsed && (
                    <div className="sb-logo">
                        <div className="sb-logo-mark" />
                        <span>SAUS</span>
                    </div>
                )}
                <Tooltip title={collapsed ? '사이드바 펼치기' : '사이드바 접기'} arrow placement="right">
                    <button
                        type="button"
                        className="sb-toggle"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                    >
                        <IconMenu />
                    </button>
                </Tooltip>
            </div>

            <button type="button" className="sb-new" onClick={onCreateSession} title="새 대화">
                <IconPlus className="ic-sm" />
                <span className="lbl">새 대화</span>
            </button>

            <div className="sb-list">
                {sessions.length === 0 ? (
                    !collapsed && <div className="sb-empty">세션이 없습니다</div>
                ) : (
                    <>
                        {favoriteSessions.length > 0 && (
                            <>
                                {!collapsed && <div className="sb-section">즐겨찾기</div>}
                                {favoriteSessions.map(renderSession)}
                            </>
                        )}
                        {regularSessions.length > 0 && (
                            <>
                                {!collapsed && <div className="sb-section">최근 대화</div>}
                                {regularSessions.map(renderSession)}
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="sb-foot">
                {collapsed ? (
                    <Tooltip title={`사용자: ${userId}`} arrow placement="right">
                        <div className="sb-user" role="presentation">
                            <div className="sb-avatar">{userInitial}</div>
                        </div>
                    </Tooltip>
                ) : (
                    <div className="sb-user" role="presentation">
                        <div className="sb-avatar">{userInitial}</div>
                        <div className="who">
                            <span className="name">사용자</span>
                            <span className="sub">{userId}</span>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};
