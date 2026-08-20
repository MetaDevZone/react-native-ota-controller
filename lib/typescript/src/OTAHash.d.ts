declare class OTAHashClass {
    sha256(filePath: string): Promise<string>;
    verify(filePath: string, expectedHash: string): Promise<boolean>;
}
export declare const OTAHash: OTAHashClass;
export {};
//# sourceMappingURL=OTAHash.d.ts.map