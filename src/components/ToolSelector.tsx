import { FC, useState } from 'react';
import {
    Box,
    Chip,
    Popover,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Switch,
    Typography,
    Divider,
    Button,
    CircularProgress,
} from '@mui/material';
import {
    Build as BuildIcon,
} from '@mui/icons-material';
import { toolService } from '../services/api';
import { Tool } from '../types/api';

interface ToolSelectorProps {
    disabled?: boolean;
    renderTrigger?: (open: (e: React.MouseEvent<HTMLElement>) => void, isOpen: boolean) => React.ReactNode;
}

export const ToolSelector: FC<ToolSelectorProps> = ({ disabled = false, renderTrigger }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [tools, setTools] = useState<Record<string, Tool>>({});
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);

    const open = Boolean(anchorEl);

    const fetchTools = async () => {
        setLoading(true);
        try {
            const response = await toolService.getAllTools();
            setTools(response.tools);
        } catch (error) {
            console.error('Failed to fetch tools:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (disabled) return;
        setAnchorEl(event.currentTarget);
        fetchTools();
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleToggleTool = async (toolName: string, currentEnabled: boolean) => {
        setUpdating(toolName);
        try {
            await toolService.setToolEnabled(toolName, !currentEnabled);
            setTools((prev) => ({
                ...prev,
                [toolName]: {
                    ...prev[toolName],
                    enabled: !currentEnabled,
                },
            }));
        } catch (error) {
            console.error(`Failed to toggle tool ${toolName}:`, error);
        } finally {
            setUpdating(null);
        }
    };

    const handleEnableAll = async () => {
        setUpdating('all');
        try {
            await toolService.enableAllTools();
            await fetchTools();
        } catch (error) {
            console.error('Failed to enable all tools:', error);
        } finally {
            setUpdating(null);
        }
    };

    const handleDisableAll = async () => {
        setUpdating('all');
        try {
            await toolService.disableAllTools();
            await fetchTools();
        } catch (error) {
            console.error('Failed to disable all tools:', error);
        } finally {
            setUpdating(null);
        }
    };

    const enabledCount = Object.values(tools).filter((t) => t.enabled).length;
    const totalCount = Object.keys(tools).length;

    return (
        <>
            {renderTrigger ? (
                renderTrigger(handleClick, open)
            ) : (
                <Chip
                    icon={<BuildIcon />}
                    label="도구 설정"
                    onClick={handleClick}
                    disabled={disabled}
                    variant="outlined"
                    sx={{
                        transition: 'all 0.2s ease',
                        borderColor: 'rgba(63, 213, 186, 0.3)',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            borderColor: 'primary.main',
                            bgcolor: 'rgba(63, 213, 186, 0.1)',
                        },
                    }}
                />
            )}

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                PaperProps={{
                    sx: {
                        width: 320,
                        maxHeight: 400,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 'var(--r-md)',
                        boxShadow: 'var(--shadow-pop)',
                    },
                }}
            >
                <Box p={2}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <BuildIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                        <Typography variant="subtitle1" fontWeight={600}>
                            도구 설정
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                ml: 'auto',
                                color: 'text.secondary',
                                bgcolor: 'rgba(63, 213, 186, 0.1)',
                                px: 1,
                                py: 0.5,
                                borderRadius: '4px',
                            }}
                        >
                            {enabledCount}/{totalCount} 활성화
                        </Typography>
                    </Box>

                    <Box display="flex" gap={1} mb={2}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handleEnableAll}
                            disabled={updating === 'all'}
                            sx={{
                                flex: 1,
                                fontSize: '0.75rem',
                                borderColor: 'rgba(63, 213, 186, 0.3)',
                                color: 'primary.main',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'rgba(63, 213, 186, 0.1)',
                                },
                            }}
                        >
                            전체 활성화
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handleDisableAll}
                            disabled={updating === 'all'}
                            sx={{
                                flex: 1,
                                fontSize: '0.75rem',
                                borderColor: 'rgba(224, 115, 101, 0.3)',
                                color: '#E07365',
                                '&:hover': {
                                    borderColor: '#E07365',
                                    bgcolor: 'rgba(224, 115, 101, 0.1)',
                                },
                            }}
                        >
                            전체 비활성화
                        </Button>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(63, 213, 186, 0.1)', mb: 1 }} />
                </Box>

                {loading ? (
                    <Box display="flex" justifyContent="center" py={4}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <List dense sx={{ pt: 0, pb: 1, maxHeight: 250, overflow: 'auto' }}>
                        {Object.entries(tools).map(([toolName, tool]) => (
                            <ListItem
                                key={toolName}
                                sx={{
                                    px: 2,
                                    py: 0.75,
                                    '&:hover': {
                                        bgcolor: 'rgba(63, 213, 186, 0.05)',
                                    },
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                            sx={{
                                                color: tool.enabled
                                                    ? 'text.primary'
                                                    : 'text.secondary',
                                            }}
                                        >
                                            {toolName}
                                        </Typography>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    {updating === toolName ? (
                                        <CircularProgress size={20} />
                                    ) : (
                                        <Switch
                                            edge="end"
                                            size="small"
                                            checked={tool.enabled}
                                            onChange={() =>
                                                handleToggleTool(toolName, tool.enabled)
                                            }
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': {
                                                    color: 'primary.main',
                                                },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
                                                    {
                                                        bgcolor: 'primary.main',
                                                    },
                                            }}
                                        />
                                    )}
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
            </Popover>
        </>
    );
};
