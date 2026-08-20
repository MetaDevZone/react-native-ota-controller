"use strict";

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { OTAService } from "./OTAService.js";
export function OTAUpdater(props) {
  const {
    url,
    androidOtaVersion,
    iosOtaVersion,
    bundleHash,
    autoRestart,
    callbacks
  } = props;
  const propsRef = useRef({
    url,
    androidOtaVersion,
    iosOtaVersion,
    bundleHash,
    autoRestart,
    callbacks
  });
  propsRef.current = {
    url,
    androidOtaVersion,
    iosOtaVersion,
    bundleHash,
    autoRestart,
    callbacks
  };
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    const {
      url: mountUrl,
      androidOtaVersion: mountAndroid,
      iosOtaVersion: mountIos,
      bundleHash: mountHash,
      autoRestart: mountAutoRestart,
      callbacks: mountCallbacks
    } = propsRef.current;
    const bundleVersion = Platform.OS === 'ios' ? mountIos : mountAndroid;
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
  }, []);
  return null;
}
//# sourceMappingURL=OTAUpdater.js.map