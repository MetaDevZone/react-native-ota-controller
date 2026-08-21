import { useEffect, useRef } from 'react';
import { OTAService } from './OTAService';
import type { OTAErrorPayload, OTAProgressPayload } from './OTATypes';

export interface OTAControllerProgressPayload {
  downloaded: number;
  fullSize: number;
  percentage: number;
  downloadedMB: string;
  totalMB: string;
}

export interface OTAControllerCallbacks {
  onProgress?: (payload: OTAControllerProgressPayload) => void;
  onStateChange?: (state: OTAProgressPayload['status']) => void;
  onError?: (error: OTAErrorPayload) => void;
}

export interface OTAControllerProps {
  url: string;
  autoRestart?: boolean;
  callbacks?: OTAControllerCallbacks;
}

export function OTAController(props: OTAControllerProps): null {
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

        mountCallbacks?.onStateChange?.('checking');
        await new Promise((resolve) => setTimeout(resolve, 1500));

        if (cancelledRef.current) return;

        started = true;

        await OTAService.downloadAndApplyUpdate({
          url: mountUrl,
          autoRestart: mountAutoRestart,
          onError: (errorPayload: OTAErrorPayload) => {
            if (cancelledRef.current) return;
            console.warn(`OTAController Error [${errorPayload.code}]:`, errorPayload.message);
            mountCallbacks?.onError?.(errorPayload);
          },
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
        // Error handling already forwarded to onError callback
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (!started) return;
    };
  }, [url]);

  return null;
}
