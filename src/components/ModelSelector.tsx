import { FC, useState } from 'react';
import {
    Box,
    Chip,
    Popover,
    List,
    ListItem,
    ListItemText,
    Typography,
    CircularProgress,
} from '@mui/material';
import { IconSparkle, IconCheck } from './icons';

interface ModelSelectorProps {
    models: string[];
    selectedModel: string | null;
    onModelChange: (model: string | null) => void;
    disabled?: boolean;
    loading?: boolean;
    renderTrigger?: (open: (e: React.MouseEvent<HTMLElement>) => void, isOpen: boolean, label: string) => React.ReactNode;
}

export const ModelSelector: FC<ModelSelectorProps> = ({
    models,
    selectedModel,
    onModelChange,
    disabled = false,
    loading = false,
    renderTrigger,
}) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (disabled || loading) return;
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (model: string) => {
        onModelChange(model);
        handleClose();
    };

    const displayLabel = selectedModel
        ? selectedModel.length > 16
            ? selectedModel.slice(0, 16) + '…'
            : selectedModel
        : '모델 선택';

    return (
        <>
            {renderTrigger ? (
                renderTrigger(handleClick, open, displayLabel)
            ) : (
                <Chip
                    icon={loading ? <CircularProgress size={14} /> : <IconSparkle />}
                    label={displayLabel}
                    onClick={handleClick}
                    disabled={disabled || loading}
                    variant="outlined"
                    sx={{
                        transition: 'all 0.2s ease',
                        borderColor: selectedModel
                            ? 'primary.main'
                            : 'rgba(63, 213, 186, 0.3)',
                        bgcolor: selectedModel
                            ? 'rgba(63, 213, 186, 0.1)'
                            : 'transparent',
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
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                PaperProps={{
                    sx: {
                        minWidth: 220,
                        maxHeight: 320,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 'var(--r-md)',
                        boxShadow: 'var(--shadow-pop)',
                    },
                }}
            >
                <Box p={2} pb={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <IconSparkle className="ic-lg" style={{ color: 'var(--accent)' }} />
                        <Typography variant="subtitle1" fontWeight={600}>
                            모델 선택
                        </Typography>
                    </Box>
                </Box>

                <List dense sx={{ pt: 0, pb: 1, overflow: 'auto' }}>
                    {models.map((model) => (
                        <ListItem
                            key={model}
                            onClick={() => handleSelect(model)}
                            sx={{
                                px: 2,
                                py: 0.75,
                                cursor: 'pointer',
                                bgcolor: selectedModel === model
                                    ? 'rgba(63, 213, 186, 0.15)'
                                    : 'transparent',
                                '&:hover': {
                                    bgcolor: 'rgba(63, 213, 186, 0.08)',
                                },
                            }}
                        >
                            <ListItemText
                                primary={
                                    <Typography
                                        variant="body2"
                                        fontWeight={selectedModel === model ? 600 : 400}
                                        sx={{
                                            color: selectedModel === model
                                                ? 'primary.main'
                                                : 'text.primary',
                                        }}
                                    >
                                        {model}
                                    </Typography>
                                }
                            />
                            {selectedModel === model && (
                                <IconCheck className="ic-lg" style={{ color: 'var(--accent)' }} />
                            )}
                        </ListItem>
                    ))}
                </List>
            </Popover>
        </>
    );
};
