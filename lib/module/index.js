"use strict";

export * from "./OTATypes.js";
export { OTA, OTAService, OTALink, OTAError } from "./OTAService.js";
export { OTAProvider, OTARoot } from "./OTAProvider.js";
export { OTAController } from "./OTAController.js";
export { OTADownloader } from "./OTADownloader.js";
export { OTAStorage } from "./OTAStorage.js";
export { restartApp, getAppVersion, getOtaVersion, getAppId, getOtaVersion as getActiveVersion } from "./OTARestart.js";
import { OTA } from "./OTAService.js";
export default OTA;
//# sourceMappingURL=index.js.map