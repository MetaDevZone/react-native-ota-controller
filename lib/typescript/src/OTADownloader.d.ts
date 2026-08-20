import type { OTAProgressCallback } from './OTATypes';
declare class OTADownloaderClass {
    private ensureDownloadDir;
    downloadBundle(url: string, version: number, onProgress: OTAProgressCallback): Promise<string>;
}
export declare const OTADownloader: OTADownloaderClass;
export {};
//# sourceMappingURL=OTADownloader.d.ts.map