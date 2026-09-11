import { FC, useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Tooltip,
} from '@mui/material';
import { IconX, IconRefresh, IconSearch } from './icons';
import { adminService } from '../services/api';
import './Overlay.css';
import { AdminLogItem, AdminLogsQuery } from '../types/api';

interface AdminLogsDialogProps {
    open: boolean;
    onClose: () => void;
}

// 로컬 datetime-local 입력값과 epoch ms 간 변환
const toEpochMs = (local: string): number => new Date(local).getTime();
const toLocalInput = (ms: number): string => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const defaultRange = (): { start: number; end: number } => {
    const end = Date.now();
    const start = end - 7 * 24 * 60 * 60 * 1000;
    return { start, end };
};

const formatDt = (v: string | number | undefined): string => {
    if (v == null) return '-';
    let d: Date;
    if (typeof v === 'number') {
        // epoch ms 또는 sec 모두 대응
        d = new Date(v < 1e12 ? v * 1000 : v);
    } else {
        d = new Date(v);
    }
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('ko-KR');
};

const truncate = (s: unknown, max = 60): string => {
    const str = s == null ? '' : String(s);
    return str.length > max ? str.slice(0, max) + '…' : str;
};

export const AdminLogsDialog: FC<AdminLogsDialogProps> = ({ open, onClose }) => {
    const initial = defaultRange();
    const [startTime, setStartTime] = useState<number>(initial.start);
    const [endTime, setEndTime] = useState<number>(initial.end);
    const [keyword, setKeyword] = useState('');
    const [filterUserId, setFilterUserId] = useState('');
    const [filterSessionId, setFilterSessionId] = useState('');
    const [toolName, setToolName] = useState('');
    const [processSuccess, setProcessSuccess] = useState<'' | '0' | '1'>('');
    const [sortBy, setSortBy] = useState('question_dt');
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [items, setItems] = useState<AdminLogItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [searchCount, setSearchCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<AdminLogItem | null>(null);
    const [pageInput, setPageInput] = useState('');

    const lastPage = Math.max(1, Math.ceil(searchCount / Math.max(1, perPage)));

    const fetchLogs = useCallback(
        async (overridePage?: number, overridePerPage?: number) => {
            setLoading(true);
            setError(null);
            try {
                const query: AdminLogsQuery = {
                    start_time: startTime,
                    end_time: endTime,
                    page: overridePage ?? page,
                    per_page: overridePerPage ?? perPage,
                    keyword: keyword || null,
                    user_id: filterUserId || null,
                    session_id: filterSessionId || null,
                    tool_name: toolName || null,
                    process_success: processSuccess === '' ? null : (Number(processSuccess) as 0 | 1),
                    sort_by: sortBy,
                    sort_dir: sortDir,
                };
                const res = await adminService.getLogs(query);
                setItems(Array.isArray(res.items) ? res.items : []);
                setTotalCount(typeof res.total_count === 'number' ? res.total_count : 0);
                setSearchCount(typeof res.search_count === 'number' ? res.search_count : 0);
            } catch (err) {
                const msg = err instanceof Error ? err.message : '조회 실패';
                setError(msg);
                setItems([]);
                setTotalCount(0);
                setSearchCount(0);
            } finally {
                setLoading(false);
            }
        },
        [startTime, endTime, page, perPage, keyword, filterUserId, filterSessionId, toolName, processSuccess, sortBy, sortDir]
    );

    // 다이얼로그 열릴 때 초기 조회
    useEffect(() => {
        if (open) {
            fetchLogs(1, perPage);
            setPage(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleSearch = () => {
        setPage(1);
        fetchLogs(1, perPage);
    };

    const goToPage = (nextPage: number) => {
        const target = Math.min(Math.max(1, nextPage), lastPage);
        if (target === page) return;
        setPage(target);
        fetchLogs(target, perPage);
    };

    const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = parseInt(e.target.value, 10);
        setPerPage(next);
        setPage(1);
        fetchLogs(1, next);
    };

    const handlePageJump = () => {
        const n = parseInt(pageInput, 10);
        if (Number.isNaN(n)) return;
        const target = Math.min(Math.max(1, n), lastPage);
        setPage(target);
        fetchLogs(target, perPage);
        setPageInput('');
    };

    const handlePageJumpKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePageJump();
        }
    };

    const rangeFrom = searchCount === 0 ? 0 : (page - 1) * perPage + 1;
    const rangeTo = Math.min(page * perPage, searchCount);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    height: '90vh',
                    bgcolor: 'transparent',
                    backgroundImage: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)',
                    overflow: 'hidden',
                },
            }}
        >
            <div className="ov-dlg" style={{ height: '100%' }}>
                <div className="ov-head">
                    <div className="ov-head-text">
                        <span className="ov-title">챗봇 이용 기록</span>
                        <span className="mono-label">ADMIN · LOGS</span>
                    </div>
                    <span className="ov-head-spacer" />
                    <button type="button" className="ov-close" onClick={onClose} aria-label="닫기">
                        <IconX className="ic" />
                    </button>
                </div>

                {/* 외부는 고정, 내부 영역만 스크롤 — 스크롤바 유무로 필터가 시프트되지 않게 */}
                <div className="ov-body" style={{ gap: 10, overflow: 'hidden', flex: 1 }}>
                    {/* 필터 */}
                    <div className="ov-card" style={{ flex: 'none' }}>
                        <div className="ov-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'visible' }}>
                            <div className="ov-grid">
                                <div className="ov-field">
                                    <span className="mono-label">시작 시각</span>
                                    <div className="ov-input-wrap">
                                        <input
                                            type="datetime-local"
                                            value={toLocalInput(startTime)}
                                            onChange={(e) => setStartTime(toEpochMs(e.target.value))}
                                            aria-label="시작 시각"
                                        />
                                    </div>
                                </div>
                                <div className="ov-field">
                                    <span className="mono-label">종료 시각</span>
                                    <div className="ov-input-wrap">
                                        <input
                                            type="datetime-local"
                                            value={toLocalInput(endTime)}
                                            onChange={(e) => setEndTime(toEpochMs(e.target.value))}
                                            aria-label="종료 시각"
                                        />
                                    </div>
                                </div>
                                <div className="ov-field">
                                    <span className="mono-label">키워드</span>
                                    <div className="ov-input-wrap">
                                        <input
                                            value={keyword}
                                            onChange={(e) => setKeyword(e.target.value)}
                                            placeholder="질문/응답에서 검색"
                                            aria-label="키워드"
                                        />
                                    </div>
                                </div>
                                <div className="ov-field">
                                    <span className="mono-label">user_id</span>
                                    <div className="ov-input-wrap">
                                        <input value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} aria-label="user_id" />
                                    </div>
                                </div>
                                <div className="ov-field">
                                    <span className="mono-label">session_id</span>
                                    <div className="ov-input-wrap">
                                        <input value={filterSessionId} onChange={(e) => setFilterSessionId(e.target.value)} aria-label="session_id" />
                                    </div>
                                </div>
                                <div className="ov-field">
                                    <span className="mono-label">도구 이름</span>
                                    <div className="ov-input-wrap">
                                        <input
                                            value={toolName}
                                            onChange={(e) => setToolName(e.target.value)}
                                            placeholder="예: chat (비우면 전체)"
                                            aria-label="도구 이름"
                                        />
                                    </div>
                                </div>
                                <div className="ov-field">
                                    <span className="mono-label">처리 결과</span>
                                    <div className="ov-input-wrap select">
                                        <select
                                            value={processSuccess}
                                            onChange={(e) => setProcessSuccess(e.target.value as '' | '0' | '1')}
                                            aria-label="처리 결과"
                                        >
                                            <option value="">전체</option>
                                            <option value="1">성공</option>
                                            <option value="0">실패</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="ov-bar">
                                <div className="ov-field" style={{ minWidth: 150 }}>
                                    <span className="mono-label">정렬 기준</span>
                                    <div className="ov-input-wrap select">
                                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="정렬 기준">
                                            <option value="question_dt">시간</option>
                                            <option value="user_id">사용자</option>
                                            <option value="session_id">세션</option>
                                            <option value="tool_name">도구</option>
                                            <option value="process_success">결과</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="ov-field" style={{ minWidth: 230 }}>
                                    <span className="mono-label">정렬 방향</span>
                                    <div className="ov-input-wrap select">
                                        <select
                                            value={sortDir}
                                            onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
                                            aria-label="정렬 방향"
                                        >
                                            <option value="DESC">내림차순 (최신/큰 값부터)</option>
                                            <option value="ASC">오름차순 (오래된/작은 값부터)</option>
                                        </select>
                                    </div>
                                </div>

                                <span className="ov-head-spacer" />

                                <Tooltip title="새로고침" arrow>
                                    <span>
                                        <button type="button" className="ov-btn" onClick={() => fetchLogs()} disabled={loading} aria-label="새로고침">
                                            <IconRefresh className="ic-sm" />
                                        </button>
                                    </span>
                                </Tooltip>
                                <button type="button" className="ov-btn primary" onClick={handleSearch} disabled={loading}>
                                    {loading ? <div className="ov-spin" /> : <IconSearch className="ic-sm" />}
                                    검색
                                </button>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="ov-alert error" style={{ flex: 'none' }}>
                            <span className="ov-alert-text">{error}</span>
                            <button type="button" className="ov-close" onClick={() => setError(null)} aria-label="닫기">
                                <IconX className="ic-sm" />
                            </button>
                        </div>
                    )}

                    <div className="ov-hint" style={{ flex: 'none' }}>
                        기간 전체 <strong>{totalCount.toLocaleString()}</strong>건 · 필터 적용{' '}
                        <strong>{searchCount.toLocaleString()}</strong>건
                    </div>

                    {/* 결과 표 — MUI Table 골격 유지(stickyHeader), 시각은 .ov-table */}
                    <div className="ov-table">
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>시각</TableCell>
                                    <TableCell>user_id</TableCell>
                                    <TableCell>session_id</TableCell>
                                    <TableCell>tool</TableCell>
                                    <TableCell>질문</TableCell>
                                    <TableCell>응답</TableCell>
                                    <TableCell align="center">결과</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="empty">
                                            <div className="ov-spin-center" style={{ padding: 0 }}><div className="ov-spin lg" /></div>
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="empty">조회된 기록이 없습니다.</TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((row, idx) => (
                                        <TableRow
                                            key={(row.log_id as any) ?? `${row.session_id}-${idx}`}
                                            onClick={() => setSelected(row)}
                                        >
                                            <TableCell className="nowrap mono">{formatDt(row.question_dt as any)}</TableCell>
                                            <TableCell>{row.user_id}</TableCell>
                                            <TableCell className="mono">{truncate(row.session_id, 12)}</TableCell>
                                            <TableCell>
                                                <span className={'ov-tag' + (row.tool_name == null ? '' : ' accent')}>
                                                    {row.tool_name == null ? 'chat' : String(row.tool_name)}
                                                </span>
                                            </TableCell>
                                            <TableCell style={{ maxWidth: 260 }}>{truncate(row.question, 80)}</TableCell>
                                            <TableCell style={{ maxWidth: 320 }}>{truncate(row.response, 100)}</TableCell>
                                            <TableCell className="center">
                                                {row.process_success === 1 ? (
                                                    <span className="ov-tag ok">성공</span>
                                                ) : row.process_success === 0 ? (
                                                    <span className="ov-tag bad">실패</span>
                                                ) : (
                                                    <span className="ov-tag">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* 페이지 바 — MUI TablePagination(머티리얼 셀렉트 + 라벨) 대체 */}
                    <div className="ov-bar" style={{ flex: 'none', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <div className="ov-input-wrap select" style={{ width: 116, flex: 'none' }}>
                            <select value={perPage} onChange={handleChangeRowsPerPage} aria-label="페이지당 항목 수">
                                {[10, 20, 50, 100, 200].map((n) => (
                                    <option key={n} value={n}>{n}개씩</option>
                                ))}
                            </select>
                        </div>
                        <span className="ov-hint">
                            {rangeFrom.toLocaleString()}–{rangeTo.toLocaleString()} / {searchCount.toLocaleString()}
                        </span>

                        <span className="ov-head-spacer" />

                        <button type="button" className="ov-btn" onClick={() => goToPage(page - 1)} disabled={loading || page <= 1}>
                            이전
                        </button>
                        <div className="ov-input-wrap" style={{ width: 64, flex: 'none' }}>
                            <input
                                value={pageInput}
                                onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                                onKeyDown={handlePageJumpKey}
                                placeholder={String(page)}
                                inputMode="numeric"
                                style={{ textAlign: 'center' }}
                                aria-label="페이지 번호"
                            />
                        </div>
                        <span className="ov-hint">/ {lastPage.toLocaleString()}</span>
                        <button type="button" className="ov-btn" onClick={handlePageJump} disabled={loading || !pageInput}>
                            이동
                        </button>
                        <button type="button" className="ov-btn" onClick={() => goToPage(page + 1)} disabled={loading || page >= lastPage}>
                            다음
                        </button>
                    </div>

                    {/* 선택된 행 상세 — 고정 max-height + 내부 스크롤로 외부 레이아웃 유지 */}
                    {selected && (
                        <div className="ov-card" style={{ flex: 'none', maxHeight: 260 }}>
                            <div className="ov-card-head">
                                <span className="mono-label">상세</span>
                                <span className="ov-head-spacer" />
                                <button type="button" className="ov-close" onClick={() => setSelected(null)} aria-label="상세 닫기">
                                    <IconX className="ic-sm" />
                                </button>
                            </div>
                            <div className="ov-card-body">
                                <div className="ov-hint" style={{ marginBottom: 10 }}>
                                    {formatDt(selected.question_dt as any)} · {selected.user_id} ·{' '}
                                    <span className="ov-mono">{selected.session_id}</span>
                                </div>
                                <span className="mono-label">질문</span>
                                <pre className="ov-pre">{String(selected.question ?? '')}</pre>
                                <div style={{ height: 12 }} />
                                <span className="mono-label">응답</span>
                                <pre className="ov-pre">{String(selected.response ?? '')}</pre>
                            </div>
                        </div>
                    )}
                </div>

                <div className="ov-foot">
                    <button type="button" className="ov-btn" onClick={onClose}>닫기</button>
                </div>
            </div>
        </Dialog>
    );
};
