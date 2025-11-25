import { useState, useEffect, useRef } from 'react';

// 랜덤 타이핑 속도 생성 (10ms ~ 20ms) - 사람이 타이핑하는 속도
const getRandomDelay = () => {
    return Math.floor(Math.random() * 10) + 10;
};

export const useTypingEffect = (text: string, isTyping: boolean) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevTextRef = useRef<string>('');

    // 텍스트가 변경되면 리셋
    useEffect(() => {
        if (text !== prevTextRef.current) {
            console.log('[Typing] Text changed, resetting:', text.substring(0, 50));
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

        if (currentIndex < text.length) {
            const delay = getRandomDelay();
            timeoutRef.current = setTimeout(() => {
                setDisplayedText((prev) => prev + text[currentIndex]);
                setCurrentIndex((prev) => prev + 1);
            }, delay);
        }

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
