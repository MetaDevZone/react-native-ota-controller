export declare function restartApp(): void;
export declare function getAppVersion(): string;
/**
 * Returns the OTA bundle version currently running in the active session.
 * e.g. If bundle 1 is running and bundle 2 downloads silently in background,
 * getOtaVersion() will continue to return 1 until the app restarts.
 */
export declare function getOtaVersion(): number;
export declare function confirmNativeBootSuccess(): Promise<void>;
//# sourceMappingURL=OTARestart.d.ts.map