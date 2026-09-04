import type { OTAProgressCallback } from './OTATypes';
declare class OTADownloaderClass {
    private ensureDownloadDir;
    downloadBundle(url: string, onProgress: OTAProgressCallback, headers?: Record<string, string>): Promise<string>;
}
export declare const OTADownloader: OTADownloaderClass;
export {};
//# sourceMappingURL=OTADownloader.d.ts.map