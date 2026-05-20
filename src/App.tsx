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
    mode: 'light',
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
                    ? { main: '#2dd4bf', light: '#5fdfc9', dark: '#0d9488', contrastText: '#0f2e2a' }
                    : { main: '#0d9488', light: '#2dd4bf', dark: '#0f766e', contrastText: '#ffffff' },
            secondary:
                mode === 'dark'
                    ? { main: '#f4a48b', light: '#f7baa6', dark: '#c8553d' }
                    : { main: '#c8553d', light: '#f4a48b', dark: '#a04330' },
            background:
                mode === 'dark'
                    ? { default: '#0a0d0d', paper: '#111615' }
                    : { default: '#f8f8f6', paper: '#ffffff' },
            text:
                mode === 'dark'
                    ? { primary: '#e7ece9', secondary: '#aab3b0', disabled: '#4a5250' }
                    : { primary: '#14201d', secondary: '#4b5754', disabled: '#a8b0ad' },
            divider: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
            error: { main: mode === 'dark' ? '#fb7185' : '#dc2626' },
            warning: { main: mode === 'dark' ? '#f0b86c' : '#c97a23' },
            success: { main: mode === 'dark' ? '#4ade80' : '#16a34a' },
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
        return saved === 'light' || saved === 'dark' ? saved : 'light';
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
