/* SAUS 시안 아이콘 셋 — sample/icons.jsx 기반
 * 모든 아이콘 stroke-width 1.6, round join/cap 통일
 * 앱 전체 단일 아이콘 소스 (@mui/icons-material 제거됨)
 */
import { FC, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { className?: string };

const base = (className?: string): SVGProps<SVGSVGElement> => ({
    className: ['ic', className].filter(Boolean).join(' '),
    viewBox: '0 0 24 24',
    'aria-hidden': true,
});

export const IconMenu: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
);

export const IconPlus: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 5v14M5 12h14" />
    </svg>
);

export const IconHistory: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
    </svg>
);

export const IconShield: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
    </svg>
);

export const IconChevronDown: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M6 9l6 6 6-6" />
    </svg>
);

export const IconEdit: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M4 20h4l10-10-4-4L4 16v4z" />
        <path d="M14 6l4 4" />
    </svg>
);

export const IconTrash: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M6 7l1 13h10l1-13" />
        <path d="M10 11v6M14 11v6" />
    </svg>
);

export const IconCheck: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M5 12l5 5L20 7" />
    </svg>
);

export const IconX: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

export const IconPaperclip: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.49" />
    </svg>
);

export const IconSend: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
);

export const IconStop: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
);

export const IconBrain: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5v.7a3.5 3.5 0 0 0-2 6.3 3.5 3.5 0 0 0 2 6.3v.7A3.5 3.5 0 0 0 9.5 22 2.5 2.5 0 0 0 12 19.5V4.5A2.5 2.5 0 0 0 9.5 2z" />
        <path d="M14.5 2A3.5 3.5 0 0 1 18 5.5v.7a3.5 3.5 0 0 1 2 6.3 3.5 3.5 0 0 1-2 6.3v.7a3.5 3.5 0 0 1-3.5 3.5A2.5 2.5 0 0 1 12 19.5V4.5A2.5 2.5 0 0 1 14.5 2z" />
    </svg>
);

export const IconGauge: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 14l4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
);

export const IconGlobe: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
);

export const IconTool: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-3 3-2-2 3-3z" />
    </svg>
);

export const IconSparkle: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8L16.5 19.5l1.8-.7z" />
    </svg>
);

export const IconInfo: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M11 12h1v4h1" />
    </svg>
);

export const IconSun: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.4 1.4M17.66 17.66l1.42 1.42M4.93 19.07l1.4-1.41M17.66 6.34l1.42-1.42" />
    </svg>
);

export const IconMoon: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
);

export const IconFile: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
        <path d="M14 3v5h5" />
    </svg>
);

export const IconStar: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 3l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.2L6.6 19.4l1.3-6L3.3 9.2l6.1-.6L12 3z" />
    </svg>
);

export const IconStarFilled: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M12 3l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.2L6.6 19.4l1.3-6L3.3 9.2l6.1-.6L12 3z" fill="currentColor" />
    </svg>
);

export const IconRefresh: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
    </svg>
);

export const IconSearch: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
    </svg>
);

export const IconSave: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
    </svg>
);

export const IconSettings: FC<IconProps> = ({ className, ...rest }) => (
    <svg {...base(className)} {...rest}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
);
