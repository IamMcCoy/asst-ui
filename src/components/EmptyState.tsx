import { FC } from 'react';
import './EmptyState.css';

interface Starter {
    n: string;
    title: string;
    sub: string;
    tool: string;
    prompt: string;
}

const STARTERS: Starter[] = [
    { n: '01', title: 'IP 주소 평판 확인', sub: '의심스러운 IP의 위협 평판과 위치', tool: 'analyze_ip', prompt: '123.1.2.33 IP 주소를 분석해줘' },
    { n: '02', title: '최신 CTI 조회', sub: '특정 CVE 취약점 상세 정보', tool: 'search_cti', prompt: 'CVE-2026-1731 취약점 정보 알려줘' },
    { n: '03', title: 'XOAR 데이터 조회', sub: '티켓 · 인시던트 통계를 자연어로 질의', tool: 'text2sql', prompt: '위험도가 low인 티켓의 수를 알려주세요' },
    { n: '04', title: '웹 로그 패턴 분석', sub: 'Apache access.log 의심 트래픽 탐지', tool: 'text2seql', prompt: '지난 24시간 동안 가장 빈번하게 발생한 공격 유형(attack_nm) 상위 10개를 알려줘.' },
];

interface EmptyStateProps {
    onSelectPrompt?: (prompt: string) => void;
    disabled?: boolean;
    modelName?: string | null;
}

const today = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

// 시안의 Home — 좌측 헤드라인 + 우측 "시작하기" 번호 리스트
export const EmptyState: FC<EmptyStateProps> = ({ onSelectPrompt, disabled = false, modelName }) => {
    return (
        <section className="home">
            <div className="home-grid">
                <div className="home-hero">
                    <div className="home-status">
                        <span className="home-status-dot" />
                        {today()} · 에이전트 대기{modelName ? ` · ${modelName}` : ''}
                    </div>
                    <h1>무엇을<br />분석해 드릴까요<span className="q">?</span></h1>
                    <p>IP · 도메인 · CVE · 파일 · 로그를 한 곳에서. 질문하면 에이전트가 계획을 세우고, 도구를 실행하고, 근거와 함께 답합니다.</p>
                </div>
                <div className="home-starters">
                    <div className="home-starters-head mono-label">시작하기</div>
                    {STARTERS.map((s) => (
                        <button
                            type="button"
                            className="starter"
                            key={s.n}
                            onClick={() => onSelectPrompt?.(s.prompt)}
                            disabled={disabled || !onSelectPrompt}
                        >
                            <span className="starter-n">{s.n}</span>
                            <span className="starter-body">
                                <span className="starter-title">{s.title}</span>
                                <span className="starter-sub">{s.sub}</span>
                            </span>
                            <span className="starter-tool">{s.tool}</span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
};
