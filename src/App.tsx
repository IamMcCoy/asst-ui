import { FC, useState, useEffect, useMemo, createContext, useContext } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Chatbot } from './components/Chatbot';

type Mode = 'light' | 'dark';
const STORAGE_KEY = 'saus-ui-mode';

// 테마 모드 토글을 자식 컴포넌트(SessionSidebar 등)에 노출
interface ColorModeContextValue {
    mode: Mode;
    toggle: () => void;
}
const ColorModeContext = createContext<ColorModeContextValue>({
    mode: 'dark',
    toggle: () => undefined,
});
export const useColorMode = () => useContext(ColorModeContext);

// MUI 팔레트는 index.css 의 디자인 토큰과 같은 hex 를 사용한다.
// (Dialog/Table/Menu 등 유지 컴포넌트가 자연스럽게 새 톤을 따르도록)
const buildTheme = (mode: Mode) =>
    createTheme({
        palette: {
            mode,
            primary:
                mode === 'dark'
                    ? { main: '#5fd4b8', light: '#8ae3cd', dark: '#3cb99b', contrastText: '#07110e' }
                    : { main: '#0f7a63', light: '#5fd4b8', dark: '#0a5c4a', contrastText: '#ffffff' },
            secondary:
                mode === 'dark'
                    ? { main: '#d9b36a', light: '#e6c98e', dark: '#b8892f' }
                    : { main: '#b8892f', light: '#d9b36a', dark: '#8f6a1f' },
            background:
                mode === 'dark'
                    ? { default: '#0b0f0e', paper: '#111715' }
                    : { default: '#f4f3ee', paper: '#fbfaf7' },
            text:
                mode === 'dark'
                    ? { primary: '#e9ede9', secondary: '#a2aba5', disabled: '#4a524e' }
                    : { primary: '#151f1b', secondary: '#56615c', disabled: '#b3bab6' },
            divider: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(20,30,26,0.09)',
            error: { main: mode === 'dark' ? '#e5766a' : '#c9483a' },
            warning: { main: mode === 'dark' ? '#d9b36a' : '#b8892f' },
            success: { main: mode === 'dark' ? '#5fd4b8' : '#0f7a63' },
        },
        typography: {
            fontFamily: [
                '"Pretendard Variable"',
                'Pretendard',
                'ui-sans-serif',
                '-apple-system',
                'BlinkMacSystemFont',
                '"Segoe UI"',
                'sans-serif',
            ].join(','),
            fontSize: 14,
            body1: { letterSpacing: '-0.005em' },
            body2: { letterSpacing: '-0.005em' },
            h1: { fontWeight: 700, letterSpacing: '-0.02em' },
            h2: { fontWeight: 700, letterSpacing: '-0.02em' },
            h3: { fontWeight: 600, letterSpacing: '-0.01em' },
            h4: { fontWeight: 600 },
            h5: { fontWeight: 600 },
            h6: { fontWeight: 600 },
        },
        shape: {
            borderRadius: 8,
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 500,
                        borderRadius: 6,
                        padding: '6px 12px',
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 6,
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

const App: FC = () => {
    // 런타임 환경 변수 사용 (window.__ENV__)
    // 개발 환경에서는 process.env 사용
    const userId = window.__ENV__?.USER_ID ||
                   process.env.REACT_APP_USER_ID ||
                   'demo-user';

    const [mode, setMode] = useState<Mode>(() => {
        const saved = (typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null) as Mode | null;
        return saved === 'light' || saved === 'dark' ? saved : 'dark';
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // private mode 등에서 localStorage 사용 불가하면 무시
        }
        // body class 동기화 — index.css의 디자인 토큰(body.theme-light/dark) 적용용
        const cls = document.body.classList;
        cls.remove('theme-light', 'theme-dark');
        cls.add('theme-' + mode);
        if (!cls.contains('dens-compact') && !cls.contains('dens-cozy')) {
            cls.add('dens-compact');
        }
    }, [mode]);

    const colorMode = useMemo<ColorModeContextValue>(
        () => ({
            mode,
            toggle: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
        }),
        [mode]
    );

    const theme = useMemo(() => buildTheme(mode), [mode]);

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Chatbot userId={userId} />
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default App;
