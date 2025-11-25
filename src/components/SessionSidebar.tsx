import { FC, useState } from 'react';
import {
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    IconButton,
    TextField,
    Box,
    Typography,
    Button,
    Fade,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Chat as ChatIcon,
    Settings as SettingsIcon,
    Person as PersonIcon,
    KeyboardArrowUp as ArrowUpIcon,
    MenuOpen as MenuOpenIcon,
    Menu as MenuIcon,
} from '@mui/icons-material';
import { Session } from '../types/api';
import { SettingsDialog } from './SettingsDialog';

interface SessionSidebarProps {
    sessions: Session[];
    currentSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onCreateSession: () => void;
    onDeleteSession: (sessionId: string) => void;
    onUpdateTitle: (sessionId: string, title: string) => void;
    userId: string;
}

export const SessionSidebar: FC<SessionSidebarProps> = ({
                                                            sessions,
                                                            currentSessionId,
                                                            onSelectSession,
                                                            onCreateSession,
                                                            onDeleteSession,
                                                            onUpdateTitle,
                                                            userId,
                                                        }) => {
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
    const [collapsed, setCollapsed] = useState(false);

    const handleStartEdit = (session: Session) => {
        setEditingSessionId(session.session_id);
        setEditTitle(session.title);
    };

    const handleSaveEdit = (sessionId: string) => {
        if (editTitle.trim()) {
            onUpdateTitle(sessionId, editTitle.trim());
        }
        setEditingSessionId(null);
        setEditTitle('');
    };

    const handleCancelEdit = () => {
        setEditingSessionId(null);
        setEditTitle('');
    };

    const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchor(event.currentTarget);
    };

    const handleUserMenuClose = () => {
        setUserMenuAnchor(null);
    };

    const handleOpenSettings = () => {
        handleUserMenuClose();
        setSettingsOpen(true);
    };

    const sidebarWidth = collapsed ? 72 : 300;

    return (
        <Drawer
            variant="permanent"
            anchor="left"
            sx={{
                width: sidebarWidth,
                flexShrink: 0,
                transition: 'width 0.3s ease',
                '& .MuiDrawer-paper': {
                    width: sidebarWidth,
                    boxSizing: 'border-box',
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    backdropFilter: 'blur(20px)',
                    borderRight: '1px solid rgba(99, 102, 241, 0.1)',
                    transition: 'width 0.3s ease',
                },
            }}
        >
            <Box p={collapsed ? 1.5 : 2.5}>
                <Box display="flex" alignItems="center" justifyContent={collapsed ? "center" : "flex-start"} gap={1} mb={2}>
                    <Tooltip title={collapsed ? "사이드바 펼치기" : "사이드바 접기"} arrow placement="right">
                        <IconButton
                            onClick={() => setCollapsed(!collapsed)}
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                '&:hover': {
                                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                                    color: 'primary.main',
                                },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {collapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                    {!collapsed && (
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            SAUS
                        </Typography>
                    )}
                </Box>
                {collapsed ? (
                    <IconButton
                        onClick={onCreateSession}
                        sx={{
                            width: '100%',
                            height: 48,
                            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                            color: 'white',
                            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
                                boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.6)',
                                transform: 'translateY(-2px)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                ) : (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        fullWidth
                        onClick={onCreateSession}
                        sx={{
                            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
                                boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.6)',
                                transform: 'translateY(-2px)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        새 대화
                    </Button>
                )}
            </Box>

            <List sx={{ flex: 1, overflow: 'auto', px: collapsed ? 0.5 : 1.5 }}>
                {sessions.length === 0 ? (
                    <Box p={collapsed ? 1 : 3} textAlign="center">
                        <ChatIcon
                            sx={{
                                fontSize: collapsed ? 32 : 48,
                                color: 'text.secondary',
                                opacity: 0.3,
                                mb: collapsed ? 0 : 1,
                            }}
                        />
                        {!collapsed && (
                            <Typography variant="body2" color="text.secondary">
                                세션이 없습니다
                            </Typography>
                        )}
                    </Box>
                ) : (
                    sessions.map((session) => (
                        <Fade in key={session.session_id} timeout={300}>
                            <ListItem
                                disablePadding
                                sx={{ mb: 1 }}
                                onMouseEnter={() => setHoveredSessionId(session.session_id)}
                                onMouseLeave={() => setHoveredSessionId(null)}
                            >
                                {editingSessionId === session.session_id ? (
                                    <Box
                                        sx={{
                                            width: '100%',
                                            p: 1,
                                            display: 'flex',
                                            gap: 1,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <TextField
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            size="small"
                                            fullWidth
                                            autoFocus
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSaveEdit(session.session_id);
                                                }
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: 'rgba(99, 102, 241, 0.05)',
                                                },
                                            }}
                                        />
                                        <IconButton
                                            size="small"
                                            onClick={() => handleSaveEdit(session.session_id)}
                                            sx={{
                                                color: 'primary.main',
                                                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.1)' },
                                            }}
                                        >
                                            <CheckIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={handleCancelEdit}
                                            sx={{
                                                color: 'text.secondary',
                                                '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.1)' },
                                            }}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ) : collapsed ? (
                                    <ListItemButton
                                        selected={currentSessionId === session.session_id}
                                        onClick={() => onSelectSession(session.session_id)}
                                        sx={{
                                            borderRadius: '12px',
                                            background:
                                                currentSessionId === session.session_id
                                                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.1) 100%)'
                                                    : 'transparent',
                                            border: '1px solid',
                                            borderColor:
                                                currentSessionId === session.session_id
                                                    ? 'rgba(99, 102, 241, 0.3)'
                                                    : 'transparent',
                                            '&:hover': {
                                                background: 'rgba(99, 102, 241, 0.08)',
                                                borderColor: 'rgba(99, 102, 241, 0.2)',
                                            },
                                            transition: 'all 0.2s ease',
                                            justifyContent: 'center',
                                            px: 1,
                                        }}
                                    >
                                        <ChatIcon
                                            sx={{
                                                fontSize: 20,
                                                color: currentSessionId === session.session_id ? 'primary.main' : 'text.secondary',
                                            }}
                                        />
                                    </ListItemButton>
                                ) : (
                                    <ListItemButton
                                        selected={currentSessionId === session.session_id}
                                        onClick={() => onSelectSession(session.session_id)}
                                        sx={{
                                            borderRadius: '12px',
                                            background:
                                                currentSessionId === session.session_id
                                                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.1) 100%)'
                                                    : 'transparent',
                                            border: '1px solid',
                                            borderColor:
                                                currentSessionId === session.session_id
                                                    ? 'rgba(99, 102, 241, 0.3)'
                                                    : 'transparent',
                                            '&:hover': {
                                                background: 'rgba(99, 102, 241, 0.08)',
                                                borderColor: 'rgba(99, 102, 241, 0.2)',
                                                '& .action-buttons': {
                                                    opacity: 1,
                                                },
                                            },
                                            transition: 'all 0.2s ease',
                                            position: 'relative',
                                        }}
                                    >
                                        <ListItemText
                                            primary={session.title ?? "제목 없음"}
                                            secondary={(() => {
                                                try {
                                                    const date = new Date(session.metadata.updated_at);
                                                    if (isNaN(date.getTime())) {
                                                        return '';
                                                    }
                                                    return date.toLocaleDateString('ko-KR');
                                                } catch {
                                                    return '';
                                                }
                                            })()}
                                            primaryTypographyProps={{
                                                noWrap: true,
                                                variant: 'body2',
                                                fontWeight: currentSessionId === session.session_id ? 600 : 400,
                                            }}
                                            secondaryTypographyProps={{
                                                variant: 'caption',
                                                sx: { fontSize: '0.7rem' },
                                            }}
                                        />
                                        <Box
                                            className="action-buttons"
                                            sx={{
                                                display: 'flex',
                                                gap: 0.5,
                                                opacity: hoveredSessionId === session.session_id ? 1 : 0,
                                                transition: 'opacity 0.2s ease',
                                            }}
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartEdit(session);
                                                }}
                                                sx={{
                                                    color: 'primary.main',
                                                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.15)' },
                                                }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteSession(session.session_id);
                                                }}
                                                sx={{
                                                    color: 'error.main',
                                                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' },
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </ListItemButton>
                                )}
                            </ListItem>
                        </Fade>
                    ))
                )}
            </List>

            {/* User Profile Section */}
            <Box
                sx={{
                    p: collapsed ? 1 : 2,
                    borderTop: '1px solid rgba(99, 102, 241, 0.1)',
                }}
            >
                <Box
                    onClick={handleUserMenuOpen}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: collapsed ? 0 : 1.5,
                        p: collapsed ? 1 : 1.5,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        '&:hover': {
                            bgcolor: 'rgba(99, 102, 241, 0.1)',
                        },
                    }}
                >
                    <Avatar
                        sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'primary.main',
                            background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
                        }}
                    >
                        <PersonIcon />
                    </Avatar>
                    {!collapsed && (
                        <>
                            <Box flex={1} sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 600,
                                        color: 'text.primary',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    사용자
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'block',
                                    }}
                                >
                                    {userId}
                                </Typography>
                            </Box>
                            <ArrowUpIcon
                                sx={{
                                    color: 'text.secondary',
                                    fontSize: 20,
                                }}
                            />
                        </>
                    )}
                </Box>
            </Box>

            {/* User Menu */}
            <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                PaperProps={{
                    sx: {
                        width: 240,
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '12px',
                        mt: -1,
                    },
                }}
            >
                <Box px={2} py={1.5}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        사용자 ID
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {userId}
                    </Typography>
                </Box>
                <Divider sx={{ borderColor: 'rgba(99, 102, 241, 0.1)' }} />
                <MenuItem
                    onClick={handleOpenSettings}
                    sx={{
                        gap: 1.5,
                        py: 1.5,
                        '&:hover': {
                            bgcolor: 'rgba(99, 102, 241, 0.1)',
                        },
                    }}
                >
                    <SettingsIcon fontSize="small" />
                    <Typography variant="body2">설정</Typography>
                </MenuItem>
            </Menu>

            <SettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                userId={userId}
            />
        </Drawer>
    );
};