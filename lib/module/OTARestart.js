"use strict";

import { NativeModules } from 'react-native';
const {
  OTARestart
} = NativeModules;
const constants = OTARestart?.getConstants?.() ?? OTARestart;

// Current running session me jo bundle loaded hai, uska version JS boot time par freeze ho jata hai
const sessionLoadedOtaVersion = (() => {
  if (typeof OTARestart?.getOtaVersion === 'function') {
    try {
      const ver = OTARestart.getOtaVersion();
      if (typeof ver === 'number') return ver;
    } catch {}
  }
  if (constants?.otaVersion !== undefined && Number.isFinite(Number(constants.otaVersion))) {
    return Number(constants.otaVersion);
  }
  return 0;
})();
export function restartApp() {
  if (OTARestart?.restart) {
    OTARestart.restart();
  } else {
    console.warn('OTARestart native module not linked (check MainApplication.kt / package registration)');
  }
}
export function getAppVersion() {
  if (typeof OTARestart?.getAppVersion === 'function') {
    try {
      const ver = OTARestart.getAppVersion();
      if (typeof ver === 'string') return ver;
    } catch {}
  }
  if (constants?.appVersion) {
    return String(constants.appVersion);
  }
  return 'unknown';
}

/**
 * Returns the OTA bundle version currently running in the active session.
 * e.g. If bundle 1 is running and bundle 2 downloads silently in background,
 * getOtaVersion() will continue to return 1 until the app restarts.
 */
export function getOtaVersion() {
  return sessionLoadedOtaVersion;
}
export async function confirmNativeBootSuccess() {
  if (OTARestart?.confirmBoot) {
    try {
      await OTARestart.confirmBoot();
    } catch (e) {
      console.warn('OTA: confirmBoot failed =>', e);
    }
  } else {
    console.warn('OTARestart.confirmBoot not linked');
  }
}
//# sourceMappingURL=OTARestart.js.map