import { useState, useEffect, useRef } from 'react';

// 청크당 추가할 글자 수 — 평균 ~3 글자/tick. 익숙한 단어를 빠르게 치는 효과.
const minChunk = 2;
const maxChunkExclusive = 6; // 2~5

// 청크 사이 기본 딜레이 (ms). 랜덤하게 약간씩 흔들어 기계적 느낌 제거.
const minBaseDelay = 14;
const maxBaseDelayExclusive = 28; // 14~27ms

// 특정 글자 뒤에 추가로 멈칫하는 시간 (ms). 사람의 호흡/생각 텀.
const PUNCT_PAUSE: Record<string, number> = {
    '.': 80,
    '!': 80,
    '?': 80,
    ',': 35,
    ';': 35,
    ':': 35,
    '\n': 55,
};

const randInt = (min: number, maxExclusive: number) =>
    min + Math.floor(Math.random() * (maxExclusive - min));

export const useTypingEffect = (text: string, isTyping: boolean) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevTextRef = useRef<string>('');

    // 텍스트가 변경되면 리셋
    useEffect(() => {
        if (text !== prevTextRef.current) {
            setDisplayedText('');
            setCurrentIndex(0);
            prevTextRef.current = text;
        }
    }, [text]);

    useEffect(() => {
        if (!isTyping) {
            // 타이핑이 비활성화되면 전체 텍스트 표시
            setDisplayedText(text);
            setCurrentIndex(text.length);
            return;
        }

        if (currentIndex >= text.length) return;

        // 이번 tick에 칠 청크 길이 결정 (구두점 만나면 거기서 끊기)
        let nextIndex = Math.min(currentIndex + randInt(minChunk, maxChunkExclusive), text.length);
        for (let i = currentIndex; i < nextIndex; i++) {
            if (text[i] in PUNCT_PAUSE) {
                nextIndex = i + 1; // 구두점 포함하여 끊기
                break;
            }
        }

        const lastChar = text[nextIndex - 1];
        const baseDelay = randInt(minBaseDelay, maxBaseDelayExclusive);
        const pause = PUNCT_PAUSE[lastChar] ?? 0;
        const delay = baseDelay + pause;

        timeoutRef.current = setTimeout(() => {
            setDisplayedText(text.slice(0, nextIndex));
            setCurrentIndex(nextIndex);
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [text, currentIndex, isTyping]);

    return {
        displayedText,
        isComplete: currentIndex >= text.length,
    };
};
