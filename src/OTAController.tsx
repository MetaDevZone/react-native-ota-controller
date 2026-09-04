import { useEffect, useRef } from 'react';
import { OTA, OTAError } from './OTAService';
import type {
  OTAErrorPayload,
  OTAProgressPayload,
  OTAReleaseInfo,
} from './OTATypes';

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
  release?: OTAReleaseInfo;
  autoRestart?: boolean;
  onProgress?: (payload: OTAControllerProgressPayload) => void;
  onStateChange?: (state: OTAProgressPayload['status']) => void;
  onError?: (error: OTAErrorPayload) => void;
  callbacks?: OTAControllerCallbacks;
}

/**
 * Drop-in interactive screen controller.
 * Accepts a `release` object (or automatically uses the cached release from checkForUpdate).
 * Zero duplicate network re-checking: starts downloading and reporting progress immediately.
 */
export function OTAController(props: OTAControllerProps): null {
  const {
    release,
    autoRestart = true,
    onProgress,
    onStateChange,
    onError,
    callbacks,
  } = props;

  const propsRef = useRef({
    release,
    autoRestart,
    onProgress,
    onStateChange,
    onError,
    callbacks,
  });
  propsRef.current = {
    release,
    autoRestart,
    onProgress,
    onStateChange,
    onError,
    callbacks,
  };

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const {
      release: mountRelease,
      autoRestart: mountAutoRestart,
      onProgress: mountOnProgress,
      onStateChange: mountOnStateChange,
      onError: mountOnError,
      callbacks: mountCallbacks,
    } = propsRef.current;

    const emitProgress = (payload: OTAControllerProgressPayload) => {
      if (cancelledRef.current) return;
      mountOnProgress?.(payload);
      mountCallbacks?.onProgress?.(payload);
    };

    const emitStateChange = (state: OTAProgressPayload['status']) => {
      if (cancelledRef.current) return;
      mountOnStateChange?.(state);
      mountCallbacks?.onStateChange?.(state);
    };

    const emitError = (error: OTAErrorPayload) => {
      if (cancelledRef.current) return;
      console.warn(`OTAController Error [${error.code}]:`, error.message);
      mountOnError?.(error);
      mountCallbacks?.onError?.(error);
    };

    const targetRelease = mountRelease || OTA.getLastCheckResult()?.release;
    if (!targetRelease) {
      const err = new OTAError(
        'DOWNLOAD_FAILED',
        'OTAController: No release provided and no active release found from checkForUpdate().'
      );
      emitError(err.toPayload());
      return;
    }

    (async () => {
      try {
        await OTA.reportBootSuccess();

        emitStateChange('checking');
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (cancelledRef.current) return;

        await OTA.downloadAndApplyUpdate({
          release: targetRelease,
          autoRestart: mountAutoRestart,
          onError: emitError,
          onProgress: (payload) => {
            if (cancelledRef.current) return;
            emitStateChange(payload.status);
            emitProgress({
              downloaded: payload.downloadedBytes,
              fullSize: payload.totalBytes,
              percentage: payload.percentage,
              downloadedMB: payload.downloadedMB,
              totalMB: payload.totalMB,
            });
          },
        });
      } catch (err: any) {
        // Error handling already forwarded to onError
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [release]);

  return null;
}
