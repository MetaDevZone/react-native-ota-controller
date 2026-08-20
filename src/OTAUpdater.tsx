import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { OTAService } from './OTAService';
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
  androidOtaVersion: number;
  iosOtaVersion: number;
  bundleHash?: string;
  autoRestart?: boolean;
  callbacks?: OTAUpdaterCallbacks;
}

export function OTAUpdater(props: OTAUpdaterProps): null {
  const {
    url,
    androidOtaVersion,
    iosOtaVersion,
    bundleHash,
    autoRestart,
    callbacks,
  } = props;

  const propsRef = useRef({
    url,
    androidOtaVersion,
    iosOtaVersion,
    bundleHash,
    autoRestart,
    callbacks,
  });
  propsRef.current = { url, androidOtaVersion, iosOtaVersion, bundleHash, autoRestart, callbacks };

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const {
      url: mountUrl,
      androidOtaVersion: mountAndroid,
      iosOtaVersion: mountIos,
      bundleHash: mountHash,
      autoRestart: mountAutoRestart,
      callbacks: mountCallbacks,
    } = propsRef.current;

    const bundleVersion =
      Platform.OS === 'ios' ? mountIos : mountAndroid;

    let started = false;

    (async () => {
      try {
        await OTAService.reportBootSuccess();

        if (cancelledRef.current) return;

        mountCallbacks?.onStateChange?.('checking');

        const activeVersion = await OTAService.getActiveVersion();

        if (bundleVersion <= activeVersion) {
          mountCallbacks?.onStateChange?.('downloaded');
          return;
        }

        if (cancelledRef.current) return;

        started = true;

        await OTAService.downloadAndApplyUpdate({
          downloadUrl: mountUrl,
          bundleVersion,
          hash: mountHash,
          autoRestart: mountAutoRestart,
          onProgress: (payload: OTAProgressPayload) => {
            if (cancelledRef.current) return;

            mountCallbacks?.onStateChange?.(payload.status);

            mountCallbacks?.onProgress?.({
              downloaded: payload.downloadedBytes,
              fullSize: payload.totalBytes,
              percentage: payload.percentage,
              downloadedMB: payload.downloadedMB,
              totalMB: payload.totalMB,
            });
          },
        });
      } catch (err: any) {
        if (cancelledRef.current) return;

        const error: Error =
          err instanceof Error ? err : new Error(String(err?.message ?? err));

        console.warn('OTAUpdater: error =>', error.message);

        mountCallbacks?.onError?.(error);
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (!started) return;
    };
  }, []);

  return null;
}
