import { FC } from 'react';
import { IconSparkle, IconGlobe, IconShield, IconFile, IconBrain } from './icons';
import './EmptyState.css';

interface SuggestionCard {
    icon: React.ReactNode;
    title: string;
    description: string;
    prompt: string;
}

const SUGGESTIONS: SuggestionCard[] = [
    {
        icon: <IconGlobe className="ic-sm" />,
        title: 'IP 주소 평판 확인',
        description: '의심스러운 IP의 위협 평판과 위치 분석',
        prompt: '123.1.2.33 IP 주소를 분석해줘',
    },
    {
        icon: <IconShield className="ic-sm" />,
        title: '최신 CTI 조회',
        description: '특정 CVE 취약점 상세 정보',
        prompt: 'CVE-2026-1731 취약점 정보 알려줘',
    },
    {
        icon: <IconFile className="ic-sm" />,
        title: '업로드 파일 요약',
        description: '세션에 올린 보고서 핵심 요약',
        prompt: '업로드된 파일을 요약해줘',
    },
    {
        icon: <IconBrain className="ic-sm" />,
        title: '웹 로그 패턴 분석',
        description: 'Apache access.log 의심 트래픽 탐지',
        prompt: '최근 로그에서 의심스러운 패턴이 있는지 분석해줘',
    },
];

interface EmptyStateProps {
    onSelectPrompt?: (prompt: string) => void;
    disabled?: boolean;
}

export const EmptyState: FC<EmptyStateProps> = ({ onSelectPrompt, disabled = false }) => {
    return (
        <div className="empty">
            <div className="empty-mark">
                <IconSparkle />
            </div>
            <h1>무엇을 분석해 드릴까요?</h1>
            <p>
                IP·도메인·CVE·파일·로그를 한 곳에서. 자연어로 물어보면 적절한 도구를 자동으로 골라 분석합니다.
            </p>
            <div className="suggest">
                {SUGGESTIONS.map((s) => (
                    <button
                        type="button"
                        className="suggest-card"
                        key={s.title}
                        onClick={() => onSelectPrompt?.(s.prompt)}
                        disabled={disabled || !onSelectPrompt}
                    >
                        {s.icon}
                        <div>
                            <div className="t">{s.title}</div>
                            <div className="d">{s.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
