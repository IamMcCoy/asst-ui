import { test, expect } from '@jest/globals';
import { dispatchSseEvent, StreamHandlers, SseErrorInfo } from './api';

// error/fallback 파싱만 검증: message는 최상위, error_code/retryable은 data 안 (헷갈리기 쉬운 지점)
const makeHandlers = () => {
    const calls: {
        errors: Array<{ msg: string; info?: SseErrorInfo }>;
        fallbacks: string[];
        finals: string[];
    } = { errors: [], fallbacks: [], finals: [] };
    const handlers: StreamHandlers = {
        onProgress: () => {},
        onAnswerDelta: () => {},
        onAnswerCancel: () => {},
        onFinalAnswer: (answer) => calls.finals.push(answer),
        onFallback: (m) => calls.fallbacks.push(m),
        onError: (err, info) => calls.errors.push({ msg: err.message, info }),
    };
    return { handlers, calls };
};

test('② context 초과: message는 최상위, code/retryable은 data', () => {
    const { handlers, calls } = makeHandlers();
    dispatchSseEvent('error', {
        message: '입력 한도를 초과했습니다.',
        data: { error_code: 'context_length_exceeded', retryable: false },
    }, handlers);
    expect(calls.errors[0].msg).toBe('입력 한도를 초과했습니다.');
    expect(calls.errors[0].info).toEqual({ errorCode: 'context_length_exceeded', retryable: false });
});

test('⑥ 연결 오류: retryable true, error_code 없음', () => {
    const { handlers, calls } = makeHandlers();
    dispatchSseEvent('error', {
        message: 'Failed to connect to LLM server',
        data: { error_type: 'LLMConnectionError', retryable: true },
    }, handlers);
    expect(calls.errors[0].info).toEqual({ errorCode: undefined, retryable: true });
});

test('④ fallback(stage) → 배지 신호로 message 전달', () => {
    const { handlers, calls } = makeHandlers();
    dispatchSseEvent('fallback', {
        message: '응답이 최대 토큰 한도에 도달했습니다.',
        data: { code: 'length', partial: true },
    }, handlers);
    expect(calls.fallbacks).toEqual(['응답이 최대 토큰 한도에 도달했습니다.']);
});

test('① 정상 final은 answer로 전달', () => {
    const { handlers, calls } = makeHandlers();
    dispatchSseEvent('final', { data: { answer: '전체 답변' } }, handlers);
    expect(calls.finals).toEqual(['전체 답변']);
});
