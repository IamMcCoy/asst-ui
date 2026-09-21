import { test, expect } from '@jest/globals';
import { parseExtraInfo } from './api';

// final 이벤트의 extra_info: viz 필드 + "<도구명>:<call_id>" 키 혼재 → 한 구조로 정규화
test('text2seql / analyze_ip / analyze_weblog / create_report 키를 수집한다', () => {
    const info = parseExtraInfo({
        viz_type: 'table',
        query_result: [{ a: 1 }],
        'text2seql:call_1': { seql: 'SELECT * FROM x' },
        'analyze_ip:call_2': { filename: 'ip.json', bytes: 10, expires_at: '2026-09-02T12:00:00+09:00', download_url: 'http://h/a/ip.json' },
        'analyze_weblog:call_3': { download_url: 'http://h/a/wl.json' },
        'create_report:call_5': { filename: '보고서.pdf', download_url: 'http://h/scribe/v1/artifacts/01M/download?f=pdf' },
        'other_tool:call_4': { seql: 'ignored' },
    });
    expect(info?.viz_type).toBe('table');
    expect(info?.seql).toEqual(['SELECT * FROM x']);
    expect(info?.artifacts?.map((a) => [a.tool, a.filename])).toEqual([
        ['analyze_ip', 'ip.json'],
        ['analyze_weblog', 'wl.json'],
        ['create_report', '보고서.pdf'],
    ]);
});

test('문자열 JSON도 파싱, 의미 있는 값이 없으면 null', () => {
    expect(parseExtraInfo('{"text2seql:c":{"seql":"Q"}}')?.seql).toEqual(['Q']);
    expect(parseExtraInfo({ viz_type: 'none' })).toBeNull();
    expect(parseExtraInfo('')).toBeNull();
    expect(parseExtraInfo(null)).toBeNull();
});

test('download_url이 http(s)가 아니면 카드 생성 안 함', () => {
    expect(parseExtraInfo({ 'analyze_ip:c': { download_url: 'javascript:alert(1)' } })).toBeNull();
    expect(parseExtraInfo({ 'analyze_ip:c': { download_url: 'data:text/html,x' } })).toBeNull();
    expect(parseExtraInfo({ 'analyze_ip:c': { download_url: 'https://h/a.json' } })?.artifacts).toHaveLength(1);
});

test('create_report의 files[]는 포맷별로 각각 수집하고 만료 시각은 상위 값을 쓴다', () => {
    const info = parseExtraInfo({
        'create_report:c': {
            filename: 'r.pdf',
            expires_at: '2026-09-22T08:44:35Z',
            download_url: 'http://h/scribe/v1/artifacts/01M/download?f=pdf',
            files: [
                { format: 'docx', filename: 'r.docx', bytes: 1, download_url: 'http://h/scribe/v1/artifacts/01M/download?f=docx' },
                { format: 'pdf', filename: 'r.pdf', bytes: 2, download_url: 'http://h/scribe/v1/artifacts/01M/download?f=pdf' },
                { format: 'x', filename: 'bad', download_url: 'javascript:alert(1)' },
            ],
        },
    });
    expect(info?.artifacts?.map((a) => [a.filename, a.expires_at])).toEqual([
        ['r.docx', '2026-09-22T08:44:35Z'],
        ['r.pdf', '2026-09-22T08:44:35Z'],
    ]);
});
