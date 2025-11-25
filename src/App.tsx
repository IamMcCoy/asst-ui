import { FC } from 'react';
import { ThemeProvider, createTheme, CssBaseline, GlobalStyles } from '@mui/material';
import { Chatbot } from './components/Chatbot';

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#6366F1',
            light: '#818CF8',
            dark: '#4F46E5',
        },
        secondary: {
            main: '#EC4899',
            light: '#F472B6',
            dark: '#DB2777',
        },
        background: {
            default: '#0F172A',
            paper: '#1E293B',
        },
        text: {
            primary: '#F1F5F9',
            secondary: '#94A3B8',
        },
    },
    typography: {
        fontFamily: [
            'Inter',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
        ].join(','),
        h1: {
            fontWeight: 700,
        },
        h2: {
            fontWeight: 700,
        },
        h3: {
            fontWeight: 600,
        },
        h4: {
            fontWeight: 600,
        },
        h5: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 600,
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 10,
                    padding: '10px 20px',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 10,
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
    },
});

const globalStyles = (
    <GlobalStyles
        styles={{
            body: {
                margin: 0,
                padding: 0,
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                minHeight: '100vh',
            },
            '::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
            },
            '::-webkit-scrollbar-track': {
                background: 'rgba(30, 41, 59, 0.3)',
                borderRadius: '10px',
            },
            '::-webkit-scrollbar-thumb': {
                background: 'rgba(99, 102, 241, 0.5)',
                borderRadius: '10px',
                '&:hover': {
                    background: 'rgba(99, 102, 241, 0.7)',
                },
            },
        }}
    />
);

const App: FC = () => {
    // 런타임 환경 변수 사용 (window.__ENV__)
    // 개발 환경에서는 process.env 사용
    const userId = window.__ENV__?.USER_ID ||
                   process.env.REACT_APP_USER_ID ||
                   'demo-user';

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {globalStyles}
            <Chatbot userId={userId} />
        </ThemeProvider>
    );
};

export default App;