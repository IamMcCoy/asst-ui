import { FC, useState, KeyboardEvent, ChangeEvent } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Paper,
    Chip,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Send as SendIcon,
    Psychology as ThinkingIcon,
    History as HistoryIcon,
    InfoOutlined as InfoIcon,
} from '@mui/icons-material';

interface MessageInputProps {
    onSendMessage: (
        message: string,
        options: {
            thinkingMode: boolean;
            historyMode: boolean;
        }
    ) => void;
    disabled?: boolean;
}

export const MessageInput: FC<MessageInputProps> = ({
                                                        onSendMessage,
                                                        disabled = false,
                                                    }) => {
    const [message, setMessage] = useState('');
    const [thinkingMode, setThinkingMode] = useState(false);
    const [historyMode, setHistoryMode] = useState(true);

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSendMessage(message.trim(), {
                thinkingMode,
                historyMode,
            });
            setMessage('');
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);
    };

    return (
        <Box>
            <Paper
                elevation={0}
                sx={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                    borderRadius: '20px',
                }}
            >
                <Box p={2}>
                    <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                        <Tooltip title="깊이 있는 분석을 제공합니다" arrow>
                            <Chip
                                icon={<ThinkingIcon />}
                                label="사고 모드"
                                onClick={() => setThinkingMode(!thinkingMode)}
                                color={(thinkingMode ? 'primary' : 'default') as 'primary' | 'default'}
                                variant={(thinkingMode ? 'filled' : 'outlined') as 'filled' | 'outlined'}
                                sx={{
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                    },
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="이전 대화 내역을 참고합니다" arrow>
                            <Chip
                                icon={<HistoryIcon />}
                                label="히스토리 모드"
                                onClick={() => setHistoryMode(!historyMode)}
                                color={(historyMode ? 'primary' : 'default') as 'primary' | 'default'}
                                variant={(historyMode ? 'filled' : 'outlined') as 'filled' | 'outlined'}
                                sx={{
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                    },
                                }}
                            />
                        </Tooltip>
                    </Box>

                    <Box display="flex" gap={1} alignItems="flex-end">
                        <TextField
                            value={message}
                            onChange={handleChange}
                            onKeyPress={handleKeyPress}
                            placeholder="메시지를 입력하세요..."
                            multiline
                            maxRows={4}
                            fullWidth
                            disabled={disabled}
                            variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '14px',
                                    bgcolor: 'rgba(30, 41, 59, 0.5)',
                                    '& fieldset': {
                                        borderColor: 'rgba(99, 102, 241, 0.2)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'rgba(99, 102, 241, 0.4)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'primary.main',
                                    },
                                },
                            }}
                        />
                        <IconButton
                            onClick={handleSend}
                            disabled={!message.trim() || disabled}
                            sx={{
                                background: !message.trim() || disabled
                                    ? 'rgba(99, 102, 241, 0.2)'
                                    : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                                color: 'white',
                                width: 48,
                                height: 48,
                                boxShadow: !message.trim() || disabled
                                    ? 'none'
                                    : '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
                                '&:hover': {
                                    background: !message.trim() || disabled
                                        ? 'rgba(99, 102, 241, 0.2)'
                                        : 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
                                    transform: !message.trim() || disabled ? 'none' : 'translateY(-2px)',
                                    boxShadow: !message.trim() || disabled
                                        ? 'none'
                                        : '0 6px 20px 0 rgba(99, 102, 241, 0.6)',
                                },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <SendIcon />
                        </IconButton>
                    </Box>
                </Box>
            </Paper>

            {/* Disclaimer Message */}
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={0.5}
                mt={1.5}
                px={2}
            >
                <InfoIcon
                    sx={{
                        fontSize: 14,
                        color: 'text.secondary',
                        opacity: 0.6,
                    }}
                />
                <Typography
                    variant="caption"
                    sx={{
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        opacity: 0.8,
                        textAlign: 'center',
                    }}
                >
                    제공되는 분석 결과는 참고 자료로 활용해 주세요. 실제 보안 조치는 전문가와 상의해 주세요.
                </Typography>
            </Box>
        </Box>
    );
};