import { FC, useState, useMemo, useEffect, useRef, KeyboardEvent, MouseEvent } from 'react';
import { Session } from '../types/api';
import {
    IconEdit,
    IconTrash,
    IconCheck,
    IconX,
    IconStar,
    IconStarFilled,
    IconMenu,
    IconPlus,
    IconSearch,
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

const COLLAPSED_KEY = 'saus-sb-collapsed';

// 세션 갱신일 → 그룹 라벨 ("오늘 / 어제 / 9월 8일 / 2025년 12월 1일"). 날짜가 없으면 방금 만든 세션 → 오늘
const groupLabel = (iso?: string): string => {
    if (!iso) return '오늘';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '오늘';
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
    if (dayDiff <= 0) return '오늘';
    if (dayDiff === 1) return '어제';
    if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
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
    const [query, setQuery] = useState('');
    const searchRef = useRef<HTMLInputElement | null>(null);
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
    });
    const toggleCollapsed = () => {
        setCollapsed((v) => {
            try { localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1'); } catch { /* ignore */ }
            return !v;
        });
    };

    // ⌘K / Ctrl+K → 검색, ⌘N / Ctrl+N → 새 대화 (시안의 단축키 힌트와 일치)
    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey)) return;
            if (e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
            else if (e.key === 'n') { e.preventDefault(); onCreateSession(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCreateSession]);

    const handleStartEdit = (e: MouseEvent, session: Session) => {
        e.stopPropagation();
        setEditingSessionId(session.session_id);
        setEditTitle(session.title ?? '');
    };

    const handleSaveEdit = (sessionId: string) => {
        const next = editTitle.trim();
        if (next) onUpdateTitle(sessionId, next);
        setEditingSessionId(null);
        setEditTitle('');
    };

    const handleCancelEdit = () => {
        setEditingSessionId(null);
        setEditTitle('');
    };

    const handleEditKey = (e: KeyboardEvent<HTMLInputElement>, sessionId: string) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(sessionId); }
        else if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
    };

    const userInitial = (userId || 'U').trim().charAt(0).toUpperCase() || 'U';

    // 검색 필터 → 즐겨찾기 그룹 + 날짜 그룹 (정렬은 원본 순서 유지)
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q ? sessions.filter((s) => (s.title || '').toLowerCase().includes(q)) : sessions;
        const result: { label: string; items: Session[] }[] = [];
        const fav = isFavorite ? filtered.filter((s) => isFavorite(s.session_id)) : [];
        if (fav.length) result.push({ label: '즐겨찾기', items: fav });
        const rest = isFavorite ? filtered.filter((s) => !isFavorite(s.session_id)) : filtered;
        for (const s of rest) {
            const label = groupLabel(s.metadata?.updated_at || s.metadata?.created_at);
            const last = result[result.length - 1];
            if (last && last.label === label && last.label !== '즐겨찾기') last.items.push(s);
            else result.push({ label, items: [s] });
        }
        return result;
    }, [sessions, query, isFavorite]);

    const renderSession = (session: Session) => {
        const isActive = currentSessionId === session.session_id;
        const isRunning = !!activeTaskMap[session.session_id] || !!session.active_task_id;
        const favored = isFavorite ? isFavorite(session.session_id) : false;

        if (editingSessionId === session.session_id) {
            return (
                <div className="sb-item-edit" key={session.session_id}>
                    <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleEditKey(e, session.session_id)}
                    />
                    <button type="button" className="confirm" onClick={() => handleSaveEdit(session.session_id)} aria-label="저장">
                        <IconCheck className="ic-sm" />
                    </button>
                    <button type="button" onClick={handleCancelEdit} aria-label="취소">
                        <IconX className="ic-sm" />
                    </button>
                </div>
            );
        }

        return (
            <div
                key={session.session_id}
                role="button"
                tabIndex={0}
                className={'sb-item' + (isActive ? ' active' : '')}
                onClick={() => onSelectSession(session.session_id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSession(session.session_id); }
                }}
                title={session.title ?? '제목 없음'}
            >
                <span className="title-text">{session.title || '제목 없음'}</span>
                {isRunning && <span className="sb-dot" aria-label="답변 중" title="답변 중" />}
                <span className="actions">
                    {onToggleFavorite && (
                        <button
                            type="button"
                            className={favored ? 'fav active' : 'fav'}
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(session.session_id); }}
                            aria-label={favored ? '즐겨찾기 해제' : '즐겨찾기'}
                        >
                            {favored ? <IconStarFilled className="ic-sm" /> : <IconStar className="ic-sm" />}
                        </button>
                    )}
                    <button type="button" onClick={(e) => handleStartEdit(e, session)} aria-label="이름 변경">
                        <IconEdit className="ic-sm" />
                    </button>
                    <button
                        type="button"
                        className="danger"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.session_id); }}
                        aria-label="삭제"
                    >
                        <IconTrash className="ic-sm" />
                    </button>
                </span>
            </div>
        );
    };

    const toggleBtn = (
        <button
            type="button"
            className="sb-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
            <IconMenu />
        </button>
    );

    // 접힘: 같은 DOM을 유지하고 폭만 애니메이션. 텍스트 영역(.sb-x)은 페이드 아웃 후 숨김, + 타일만 노출
    return (
        <aside className={'sb' + (collapsed ? ' collapsed' : '')}>
            <div className="sb-head">
                <span className="sb-logo sb-x">SAUS</span>
                {toggleBtn}
            </div>

            <button type="button" className="sb-tile sb-tile-new" onClick={onCreateSession} title="새 대화 (⌘N)" aria-label="새 대화" tabIndex={collapsed ? 0 : -1}>
                <IconPlus className="ic-sm" />
            </button>

            <div className="sb-top sb-x">
                <button type="button" className="sb-new" onClick={onCreateSession} title="새 대화 (⌘N)">
                    <span>새 대화</span>
                    <span className="kbd">⌘N</span>
                </button>

                <div className="sb-search">
                    <IconSearch className="ic-sm sb-search-ic" />
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="대화 검색"
                        aria-label="대화 검색"
                    />
                    <span className="kbd">⌘K</span>
                </div>
            </div>

            <div className="sb-list sb-x">
                {sessions.length === 0 && <div className="sb-empty">세션이 없습니다</div>}
                {sessions.length > 0 && groups.length === 0 && <div className="sb-empty">일치하는 대화가 없습니다.</div>}
                {groups.map((g) => (
                    <div className="sb-group" key={g.label}>
                        <div className="sb-section mono-label">{g.label}</div>
                        {g.items.map(renderSession)}
                    </div>
                ))}
            </div>

            <div className="sb-foot">
                <div className="sb-avatar" title={userId}>{userInitial}</div>
                <div className="who sb-x">
                    <span className="name">{userId}</span>
                    <span className="sub">seculayer</span>
                </div>
            </div>
        </aside>
    );
};
