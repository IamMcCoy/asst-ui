import { test, expect } from '@jest/globals';
import { parseExtraInfo } from './api';

// final 이벤트의 extra_info: viz 필드 + "<도구명>:<call_id>" 키 혼재 → 한 구조로 정규화
test('text2seql / analyze_ip / analyze_weblog 키를 수집한다', () => {
    const info = parseExtraInfo({
        viz_type: 'table',
        query_result: [{ a: 1 }],
        'text2seql:call_1': { seql: 'SELECT * FROM x' },
        'analyze_ip:call_2': { filename: 'ip.json', bytes: 10, expires_at: '2026-09-02T12:00:00+09:00', download_url: 'http://h/a/ip.json' },
        'analyze_weblog:call_3': { download_url: 'http://h/a/wl.json' },
        'other_tool:call_4': { seql: 'ignored' },
    });
    expect(info?.viz_type).toBe('table');
    expect(info?.seql).toEqual(['SELECT * FROM x']);
    expect(info?.artifacts?.map((a) => [a.tool, a.filename])).toEqual([
        ['analyze_ip', 'ip.json'],
        ['analyze_weblog', 'wl.json'],
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
