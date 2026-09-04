export * from './OTATypes';
export { OTA, OTAService, OTALink, OTAError } from './OTAService';
export { OTAProvider, OTARoot, type OTAProviderProps } from './OTAProvider';
export { OTAController, type OTAControllerProps, type OTAControllerCallbacks, type OTAControllerProgressPayload, } from './OTAController';
export { OTADownloader } from './OTADownloader';
export { OTAStorage } from './OTAStorage';
export { restartApp, getAppVersion, getOtaVersion, getAppId, getOtaVersion as getActiveVersion, } from './OTARestart';
import { OTA } from './OTAService';
export default OTA;
//# sourceMappingURL=index.d.ts.map