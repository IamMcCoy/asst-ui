import { FC, useEffect, useRef, useState } from 'react';
import { docService } from '../services/api';
import { IconX, IconDownload, IconFile } from './icons';
import './DocPanel.css';

// 우측 문서 패널에 띄울 문서 하나 — 업로드 원본(PDF) 또는 답변 속 매뉴얼 링크
export interface DocRef {
    key: string;
    title: string;
    // "#page=N" 앵커 포함 가능. fetch는 앵커를 뗀 URL로, 렌더는 blob URL + 앵커로.
    url: string;
    kind: 'upload' | 'manual';
    description?: string;
}

interface DocPanelProps {
    docs: DocRef[];
    activeKey: string;
    onSelect: (key: string) => void;
    onClose: () => void;
}

// iframe은 Bearer 헤더를 못 붙이므로 fetch → blob URL로 렌더.
// ponytail: 문서별 blob 캐시는 패널 생존 기간만 유지, 패널 닫히면 revoke.
export const DocPanel: FC<DocPanelProps> = ({ docs, activeKey, onSelect, onClose }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const cacheRef = useRef<Record<string, string>>({});

    const active = docs.find((d) => d.key === activeKey) ?? null;
    const [baseUrl, hash] = active ? active.url.split('#') : ['', ''];

    useEffect(() => {
        if (!baseUrl) return;
        let cancelled = false;
        setError(null);
        const cached = cacheRef.current[baseUrl];
        if (cached) {
            setBlobUrl(cached);
            return;
        }
        setLoading(true);
        setBlobUrl(null);
        docService
            .fetchBlob(baseUrl, 'application/pdf')
            .then((blob) => {
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                cacheRef.current[baseUrl] = url;
                setBlobUrl(url);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [baseUrl]);

    // 패널 unmount 시 blob URL 전부 해제
    useEffect(() => {
        const cache = cacheRef.current;
        return () => {
            Object.values(cache).forEach((u) => URL.revokeObjectURL(u));
        };
    }, []);

    const downloadName = active
        ? active.kind === 'upload'
            ? active.title
            : decodeURIComponent(baseUrl.split('/').pop() || 'manual.pdf')
        : '';

    return (
        <aside className="doc-panel">
            <div className="doc-tabs" role="tablist">
                {docs.map((d) => (
                    <button
                        key={d.key}
                        type="button"
                        role="tab"
                        aria-selected={d.key === activeKey}
                        className={'doc-tab' + (d.key === activeKey ? ' active' : '') + (d.kind === 'manual' ? ' manual' : '')}
                        onClick={() => onSelect(d.key)}
                        title={d.description ? `${d.title}\n${d.description}` : d.title}
                    >
                        <IconFile className="ic-sm" />
                        <span className="doc-tab-title">{d.title}</span>
                        {d.kind === 'manual' && <span className="doc-tab-badge">매뉴얼</span>}
                    </button>
                ))}
                <span className="doc-tabs-spacer" />
                {blobUrl && !error && (
                    <a
                        className="doc-icon-btn"
                        href={blobUrl}
                        download={downloadName}
                        title="다운로드"
                        aria-label="다운로드"
                    >
                        <IconDownload className="ic-sm" />
                    </a>
                )}
                <button type="button" className="doc-icon-btn" onClick={onClose} aria-label="패널 닫기" title="닫기">
                    <IconX className="ic-sm" />
                </button>
            </div>

            <div className="doc-body">
                {!active && <div className="doc-empty">표시할 문서를 선택하세요</div>}
                {active && loading && <div className="doc-empty">문서를 불러오는 중…</div>}
                {active && error && <div className="doc-empty doc-error">{error}</div>}
                {active && blobUrl && !error && (
                    <iframe
                        // key로 문서/페이지 변경 시 iframe 재생성 → 뷰어가 #page 앵커를 다시 읽음
                        key={blobUrl + '#' + hash}
                        className="doc-frame"
                        src={hash ? `${blobUrl}#${hash}` : blobUrl}
                        title={active.title}
                    />
                )}
            </div>
        </aside>
    );
};
