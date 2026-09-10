import { FC, useEffect, useRef, useState, PointerEvent as ReactPointerEvent } from 'react';
import { docService } from '../services/api';
import { IconX, IconDownload, IconFile } from './icons';
import './DocPanel.css';

// 우측 아티팩트 패널에 띄울 문서 하나 — 업로드 원본 / 답변 속 매뉴얼 링크 / 분석 결과 파일
export interface DocRef {
    key: string;
    title: string;
    // "#page=N" 앵커 포함 가능. fetch는 앵커를 뗀 URL로, 렌더는 blob URL + 앵커로.
    url: string;
    kind: 'upload' | 'manual' | 'artifact';
    description?: string;
}

interface DocPanelProps {
    docs: DocRef[];
    activeKey: string;
    onSelect: (key: string) => void;
    onClose: () => void;
}

type Preview = 'pdf' | 'image' | 'text' | 'none';

// 확장자로 미리보기 방식 결정 — 서버 Content-Type은 신뢰하지 않는다 (docService 주석 참고)
const previewOf = (name: string): { preview: Preview; mime: string } => {
    const ext = (name.split('#')[0].split('?')[0].split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return { preview: 'pdf', mime: 'application/pdf' };
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
        return { preview: 'image', mime: ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}` };
    }
    if (['txt', 'log', 'json', 'csv', 'tsv', 'md', 'sql', 'seql', 'xml', 'yaml', 'yml', 'html', 'htm', 'py', 'js', 'ts', 'sh', 'conf', 'ini'].includes(ext)) {
        return { preview: 'text', mime: 'text/plain' };
    }
    return { preview: 'none', mime: 'application/octet-stream' };
};

const KIND_LABEL: Record<DocRef['kind'], string> = { upload: '업로드', manual: '매뉴얼', artifact: '분석 결과' };

const WIDTH_KEY = 'saus-doc-panel-w';
const MIN_W = 360;

// 좌우 드래그로 폭 조절 + 문서 종류별 미리보기 (PDF iframe / 이미지 / 텍스트 / 다운로드만)
// iframe은 Bearer 헤더를 못 붙이므로 fetch → blob URL로 렌더.
// ponytail: 문서별 blob 캐시는 패널 생존 기간만 유지, 패널 닫히면 revoke.
export const DocPanel: FC<DocPanelProps> = ({ docs, activeKey, onSelect, onClose }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [text, setText] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const cacheRef = useRef<Record<string, string>>({});
    const [width, setWidth] = useState<number>(() => {
        try { return Number(localStorage.getItem(WIDTH_KEY)) || 560; } catch { return 560; }
    });

    const active = docs.find((d) => d.key === activeKey) ?? null;
    const [baseUrl, hash] = active ? active.url.split('#') : ['', ''];
    const { preview, mime } = previewOf(active?.title || baseUrl);

    useEffect(() => {
        if (!baseUrl || preview === 'none') { setBlobUrl(null); setText(null); return; }
        let cancelled = false;
        setError(null);
        setText(null);
        const cached = cacheRef.current[baseUrl];
        if (cached && preview !== 'text') {
            setBlobUrl(cached);
            return;
        }
        setLoading(true);
        setBlobUrl(null);
        docService
            .fetchBlob(baseUrl, mime, { anonymous: active?.kind === 'artifact' })
            .then(async (blob) => {
                if (cancelled) return;
                if (preview === 'text') {
                    setText(await blob.text());
                    return;
                }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseUrl, preview, mime]);

    // 패널 unmount 시 blob URL 전부 해제
    useEffect(() => {
        const cache = cacheRef.current;
        return () => {
            Object.values(cache).forEach((u) => URL.revokeObjectURL(u));
        };
    }, []);

    // 좌측 모서리 드래그 — pointer capture로 iframe 위에서도 이벤트 유지
    const onResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = width;
        const handle = e.currentTarget;
        handle.setPointerCapture(e.pointerId);
        document.body.classList.add('is-resizing');
        const move = (ev: PointerEvent) => {
            const maxW = Math.floor(window.innerWidth * 0.7);
            setWidth(Math.min(maxW, Math.max(MIN_W, startW + (startX - ev.clientX))));
        };
        const up = () => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            document.body.classList.remove('is-resizing');
            setWidth((w) => { try { localStorage.setItem(WIDTH_KEY, String(w)); } catch { /* ignore */ } return w; });
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
    };

    const downloadName = active
        ? active.kind === 'manual'
            ? decodeURIComponent(baseUrl.split('/').pop() || 'manual.pdf')
            : active.title
        : '';
    // 미리보기 불가/실패 시에도 원본 URL로 직접 다운로드는 가능하게
    const downloadHref = blobUrl ?? baseUrl;

    return (
        <aside className="doc-panel" style={{ width }}>
            <div className="doc-resize" onPointerDown={onResizeStart} role="separator" aria-orientation="vertical" aria-label="패널 폭 조절" />
            <div className="doc-tabs" role="tablist">
                {docs.map((d) => (
                    <button
                        key={d.key}
                        type="button"
                        role="tab"
                        aria-selected={d.key === activeKey}
                        className={'doc-tab' + (d.key === activeKey ? ' active' : '')}
                        onClick={() => onSelect(d.key)}
                        title={d.description ? `${d.title}\n${d.description}` : d.title}
                    >
                        <IconFile className="ic-sm" />
                        <span className="doc-tab-title">{d.title}</span>
                        {d.kind !== 'upload' && <span className="doc-tab-badge">{KIND_LABEL[d.kind]}</span>}
                    </button>
                ))}
                <span className="doc-tabs-spacer" />
                {active && (
                    <a
                        className="doc-icon-btn"
                        href={downloadHref}
                        download={downloadName}
                        target={blobUrl ? undefined : '_blank'}
                        rel="noopener noreferrer"
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

            {active && (
                <div className="doc-meta">
                    <span className="mono-label">{KIND_LABEL[active.kind]}</span>
                    <span className="doc-meta-title" title={active.title}>{active.title}</span>
                    {active.description && <span className="doc-meta-desc">{active.description}</span>}
                </div>
            )}

            <div className="doc-body">
                {!active && <div className="doc-empty">표시할 문서를 선택하세요</div>}
                {active && loading && <div className="doc-empty">문서를 불러오는 중…</div>}
                {active && error && (
                    <div className="doc-empty doc-error">
                        {error}
                        <a className="doc-fallback" href={baseUrl} download={downloadName} target="_blank" rel="noopener noreferrer">
                            <IconDownload className="ic-sm" /> 원본 다운로드
                        </a>
                    </div>
                )}
                {active && !loading && !error && preview === 'none' && (
                    <div className="doc-empty">
                        미리보기를 지원하지 않는 형식입니다.
                        <a className="doc-fallback" href={baseUrl} download={downloadName} target="_blank" rel="noopener noreferrer">
                            <IconDownload className="ic-sm" /> 다운로드
                        </a>
                    </div>
                )}
                {active && !error && preview === 'pdf' && blobUrl && (
                    <iframe
                        // key로 문서/페이지 변경 시 iframe 재생성 → 뷰어가 #page 앵커를 다시 읽음
                        key={blobUrl + '#' + hash}
                        className="doc-frame"
                        src={hash ? `${blobUrl}#${hash}` : blobUrl}
                        title={active.title}
                    />
                )}
                {active && !error && preview === 'image' && blobUrl && (
                    <div className="doc-image-wrap"><img className="doc-image" src={blobUrl} alt={active.title} /></div>
                )}
                {active && !error && preview === 'text' && text !== null && (
                    <pre className="doc-text">{text}</pre>
                )}
            </div>
        </aside>
    );
};
