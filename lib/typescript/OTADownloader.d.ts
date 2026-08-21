import type { OTAProgressCallback } from './OTATypes';
declare class OTADownloaderClass {
    private ensureDownloadDir;
    downloadBundle(url: string, onProgress: OTAProgressCallback, version?: number): Promise<string>;
}
export declare const OTADownloader: OTADownloaderClass;
export {};
//# sourceMappingURL=OTADownloader.d.ts.map