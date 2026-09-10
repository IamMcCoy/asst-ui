// 파일 크기 표기 — 1MB 이상은 MB(소수 2자리), 미만은 KB(소수 1자리)
export const formatFileSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    const MB = 1024 * 1024;
    if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
};
