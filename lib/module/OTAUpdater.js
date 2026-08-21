"use strict";

import { useEffect, useRef } from 'react';
import { OTAService } from "./OTAService.js";
export function OTAUpdater(props) {
  const {
    url,
    autoRestart,
    callbacks
  } = props;
  const propsRef = useRef({
    url,
    autoRestart,
    callbacks
  });
  propsRef.current = {
    url,
    autoRestart,
    callbacks
  };
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    const {
      url: mountUrl,
      autoRestart: mountAutoRestart,
      callbacks: mountCallbacks
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
          onProgress: payload => {
            if (cancelledRef.current) return;
            mountCallbacks?.onStateChange?.(payload.status);
            mountCallbacks?.onProgress?.({
              downloaded: payload.downloadedBytes,
              fullSize: payload.totalBytes,
              percentage: payload.percentage,
              downloadedMB: payload.downloadedMB,
              totalMB: payload.totalMB
            });
          }
        });
      } catch (err) {
        if (cancelledRef.current) return;
        const error = err instanceof Error ? err : new Error(String(err?.message ?? err));
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
//# sourceMappingURL=OTAUpdater.js.map