import { NativeModules } from 'react-native';

const { OTARestart } = NativeModules;

export function restartApp(): void {
  if (OTARestart?.restart) {
    OTARestart.restart();
  } else {
    console.warn(
      'OTARestart native module not linked (check MainApplication.kt / package registration)'
    );
  }
}

export async function getAppVersion(): Promise<string> {
  if (OTARestart?.getAppVersion) {
    return OTARestart.getAppVersion();
  }
  console.warn('OTARestart.getAppVersion not linked');
  return 'unknown';
}

export async function confirmNativeBootSuccess(): Promise<void> {
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