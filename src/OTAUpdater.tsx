import { useEffect, useRef } from 'react';
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
  autoRestart?: boolean;
  callbacks?: OTAUpdaterCallbacks;
}

export function OTAUpdater(props: OTAUpdaterProps): null {
  const {
    url,
    autoRestart,
    callbacks,
  } = props;

  const propsRef = useRef({
    url,
    autoRestart,
    callbacks,
  });
  propsRef.current = { url, autoRestart, callbacks };

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const {
      url: mountUrl,
      autoRestart: mountAutoRestart,
      callbacks: mountCallbacks,
    } = propsRef.current;

    if (!mountUrl) return;

    let started = false;

    (async () => {
      try {
        await OTAService.reportBootSuccess();

        if (cancelledRef.current) return;

        mountCallbacks?.onStateChange?.('checking');

        started = true;

        await OTAService.downloadAndApplyUpdate({
          downloadUrl: mountUrl,
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
  }, [url]);

  return null;
}
