import type { OTAProgressPayload } from './OTATypes';
export interface OTAUpdaterProgressPayload {
    downloaded: number;
    fullSize: number;
    percentage: number;
    downloadedMB: string;
    totalMB: string;
}
export interface OTAUpdaterCallbacks {
    onProgress?: (payload: OTAUpdaterProgressPayload) => void;
    onStateChange?: (state: OTAProgressPayload['status']) => void;
    onError?: (error: Error) => void;
}
export interface OTAUpdaterProps {
    url: string;
    autoRestart?: boolean;
    callbacks?: OTAUpdaterCallbacks;
}
export declare function OTAUpdater(props: OTAUpdaterProps): null;
//# sourceMappingURL=OTAUpdater.d.ts.map