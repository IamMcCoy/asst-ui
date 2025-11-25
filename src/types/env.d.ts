// Type definitions for runtime environment variables

export interface RuntimeEnv {
    API_BASE_URL: string;
    USER_ID: string;
}

declare global {
    interface Window {
        __ENV__?: RuntimeEnv;
    }
}

export {};
