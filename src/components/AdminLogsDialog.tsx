import { FC, useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Button,
    TextField,
    MenuItem,
    Stack,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    TablePagination,
    Chip,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress,
    Paper,
} from '@mui/material';
import { IconX, IconRefresh, IconSearch } from './icons';
import { adminService } from '../services/api';
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

    const handleChangePage = (_: unknown, newPage: number) => {
        // MUI TablePagination는 0-base
        const nextPage = newPage + 1;
        setPage(nextPage);
        fetchLogs(nextPage, perPage);
    };

    const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    height: '90vh',
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
                    관리자 — 챗봇 이용 기록
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <IconX className="ic-lg" />
                </IconButton>
            </DialogTitle>

            <DialogContent
                dividers
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    // 다이얼로그 자체에 스크롤이 생기면 스크롤바 유무에 따라 필터/버튼이 시프트됨 → 외부는 고정, 내부 영역만 스크롤
                    overflow: 'hidden',
                    minHeight: 0,
                }}
            >
                {/* 필터 영역 — 격자 정렬 + 우측 액션바 */}
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(63, 213, 186, 0.04)', flex: 'none' }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: 1.5,
                            mb: 1.5,
                        }}
                    >
                        <TextField
                            label="시작 시각"
                            type="datetime-local"
                            size="small"
                            value={toLocalInput(startTime)}
                            onChange={(e) => setStartTime(toEpochMs(e.target.value))}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <TextField
                            label="종료 시각"
                            type="datetime-local"
                            size="small"
                            value={toLocalInput(endTime)}
                            onChange={(e) => setEndTime(toEpochMs(e.target.value))}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <TextField
                            label="키워드"
                            size="small"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="질문/응답에서 검색"
                            fullWidth
                        />
                        <TextField
                            label="user_id"
                            size="small"
                            value={filterUserId}
                            onChange={(e) => setFilterUserId(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="session_id"
                            size="small"
                            value={filterSessionId}
                            onChange={(e) => setFilterSessionId(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="도구 이름"
                            size="small"
                            value={toolName}
                            onChange={(e) => setToolName(e.target.value)}
                            placeholder="예: chat (비우면 전체)"
                            fullWidth
                        />
                        <TextField
                            select
                            label="처리 결과"
                            size="small"
                            value={processSuccess}
                            onChange={(e) => setProcessSuccess(e.target.value as '' | '0' | '1')}
                            fullWidth
                        >
                            <MenuItem value="">전체</MenuItem>
                            <MenuItem value="1">성공</MenuItem>
                            <MenuItem value="0">실패</MenuItem>
                        </TextField>
                    </Box>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <TextField
                            select
                            label="정렬 기준"
                            size="small"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            sx={{ minWidth: 160 }}
                        >
                            <MenuItem value="question_dt">시간</MenuItem>
                            <MenuItem value="user_id">사용자</MenuItem>
                            <MenuItem value="session_id">세션</MenuItem>
                            <MenuItem value="tool_name">도구</MenuItem>
                            <MenuItem value="process_success">결과</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label="정렬 방향"
                            size="small"
                            value={sortDir}
                            onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
                            sx={{ minWidth: 240 }}
                        >
                            <MenuItem value="DESC">내림차순 (최신/큰 값부터)</MenuItem>
                            <MenuItem value="ASC">오름차순 (오래된/작은 값부터)</MenuItem>
                        </TextField>

                        <Box flex={1} />

                        <Tooltip title="새로고침" arrow>
                            <span>
                                <IconButton
                                    onClick={() => fetchLogs()}
                                    disabled={loading}
                                    size="small"
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1.5,
                                    }}
                                >
                                    <IconRefresh />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Button
                            variant="contained"
                            startIcon={<IconSearch />}
                            onClick={handleSearch}
                            disabled={loading}
                            disableElevation
                        >
                            검색
                        </Button>
                    </Stack>
                </Paper>

                {error && (
                    <Alert severity="error" onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Typography variant="body2" color="text.secondary" sx={{ flex: 'none' }}>
                    기간 전체: <strong>{totalCount.toLocaleString()}</strong>건 / 필터 적용:{' '}
                    <strong>{searchCount.toLocaleString()}</strong>건
                </Typography>

                {/* 결과 표 */}
                <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>시각</TableCell>
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
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>
                            ) : items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            조회된 기록이 없습니다.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((row, idx) => (
                                    <TableRow
                                        key={(row.log_id as any) ?? `${row.session_id}-${idx}`}
                                        hover
                                        onClick={() => setSelected(row)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                            {formatDt(row.question_dt as any)}
                                        </TableCell>
                                        <TableCell>{row.user_id}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                            {truncate(row.session_id, 12)}
                                        </TableCell>
                                        <TableCell>
                                            {row.tool_name == null ? (
                                                <Chip label="chat" size="small" variant="outlined" />
                                            ) : (
                                                <Chip label={String(row.tool_name)} size="small" color="primary" variant="outlined" />
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 260 }}>{truncate(row.question, 80)}</TableCell>
                                        <TableCell sx={{ maxWidth: 320 }}>{truncate(row.response, 100)}</TableCell>
                                        <TableCell align="center">
                                            {row.process_success === 1 ? (
                                                <Chip label="성공" size="small" color="success" />
                                            ) : row.process_success === 0 ? (
                                                <Chip label="실패" size="small" color="error" />
                                            ) : (
                                                <Chip label="-" size="small" variant="outlined" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Stack
                    direction="row"
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        pt: 1,
                        flex: 'none',
                    }}
                >
                    <TablePagination
                        component="div"
                        count={searchCount}
                        page={Math.max(0, page - 1)}
                        onPageChange={handleChangePage}
                        rowsPerPage={perPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[10, 20, 50, 100, 200]}
                        labelRowsPerPage="페이지당 항목 수"
                        labelDisplayedRows={({ from, to, count }) =>
                            `${from}–${to} / ${count !== -1 ? count : `${to} 이상`}`
                        }
                        sx={{ borderTop: 'none', flex: 1 }}
                    />
                    <Stack direction="row" alignItems="center" gap={1} sx={{ pr: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            페이지 이동
                        </Typography>
                        <TextField
                            size="small"
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={handlePageJumpKey}
                            placeholder={String(page)}
                            inputProps={{
                                inputMode: 'numeric',
                                style: { textAlign: 'center', width: 56 },
                                'aria-label': '페이지 번호',
                            }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            / {lastPage.toLocaleString()}
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handlePageJump}
                            disabled={loading || !pageInput}
                        >
                            이동
                        </Button>
                    </Stack>
                </Stack>

                {/* 선택된 행의 상세 보기 — 항상 같은 영역 차지(고정 max-height + 내부 스크롤)로 외부 레이아웃 안흔들림 */}
                {selected && (
                    <Paper
                        variant="outlined"
                        sx={{
                            bgcolor: 'rgba(63, 213, 186, 0.04)',
                            flex: 'none',
                            maxHeight: 260,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                                px: 2,
                                py: 1,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                flex: 'none',
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight={700}>
                                상세
                            </Typography>
                            <IconButton size="small" onClick={() => setSelected(null)} aria-label="상세 닫기">
                                <IconX />
                            </IconButton>
                        </Box>
                        <Box sx={{ p: 2, overflow: 'auto', flex: 1, minHeight: 0 }}>
                            <Stack spacing={1}>
                                <Typography variant="caption" color="text.secondary">
                                    {formatDt(selected.question_dt as any)} · {selected.user_id} ·{' '}
                                    <span style={{ fontFamily: 'monospace' }}>{selected.session_id}</span>
                                </Typography>
                                <Typography variant="body2" component="div">
                                    <strong>질문</strong>
                                    <Box component="pre" sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                        {String(selected.question ?? '')}
                                    </Box>
                                </Typography>
                                <Typography variant="body2" component="div">
                                    <strong>응답</strong>
                                    <Box component="pre" sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                        {String(selected.response ?? '')}
                                    </Box>
                                </Typography>
                            </Stack>
                        </Box>
                    </Paper>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
};
