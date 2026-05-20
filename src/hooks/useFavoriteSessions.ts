import { useCallback, useEffect, useState } from 'react';

// 사용자별 즐겨찾기 세션을 localStorage에 보관 (백엔드 미지원).
// 키 분리로 다중 계정 환경에서도 섞이지 않게.
const storageKey = (userId: string) => `saus.favorites.${userId}`;

const readSet = (userId: string): Set<string> => {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
    } catch {
        return new Set();
    }
};

export const useFavoriteSessions = (userId: string) => {
    const [favorites, setFavorites] = useState<Set<string>>(() => readSet(userId));

    useEffect(() => {
        setFavorites(readSet(userId));
    }, [userId]);

    const persist = useCallback(
        (next: Set<string>) => {
            try {
                localStorage.setItem(storageKey(userId), JSON.stringify(Array.from(next)));
            } catch {
                // quota/private mode 등 — 메모리 상태는 유지
            }
        },
        [userId]
    );

    const toggle = useCallback(
        (sessionId: string) => {
            setFavorites((prev) => {
                const next = new Set(prev);
                if (next.has(sessionId)) next.delete(sessionId);
                else next.add(sessionId);
                persist(next);
                return next;
            });
        },
        [persist]
    );

    const remove = useCallback(
        (sessionId: string) => {
            setFavorites((prev) => {
                if (!prev.has(sessionId)) return prev;
                const next = new Set(prev);
                next.delete(sessionId);
                persist(next);
                return next;
            });
        },
        [persist]
    );

    const isFavorite = useCallback((sessionId: string) => favorites.has(sessionId), [favorites]);

    return { favorites, isFavorite, toggle, remove };
};
