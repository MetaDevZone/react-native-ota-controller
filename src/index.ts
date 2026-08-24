export * from './OTATypes';
export { OTADownloader } from './OTADownloader';
export { OTAStorage } from './OTAStorage';
export { OTAService, OTAError } from './OTAService';
export { restartApp, getAppId, getAppVersion, getOtaVersion, getOtaVersion as getActiveVersion } from './OTARestart';
export { OTAController } from './OTAController';
export type {
  OTAControllerProps,
  OTAControllerCallbacks,
  OTAControllerProgressPayload,
} from './OTAController';
