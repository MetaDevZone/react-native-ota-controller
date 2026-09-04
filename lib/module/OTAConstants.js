"use strict";

import RNFS from 'react-native-fs';
export const OTA_ROOT_DIR = `${RNFS.DocumentDirectoryPath}/OTA`;
export const OTA_BUNDLES_DIR = `${OTA_ROOT_DIR}/bundles`;
export const OTA_DOWNLOAD_DIR = `${OTA_ROOT_DIR}/downloads`;
export const OTA_STAGING_DIR = `${OTA_ROOT_DIR}/staging`;
export const OTA_CURRENT_FILE = `${OTA_ROOT_DIR}/current.json`;
export const OTA_REJECTED_FILE = `${OTA_ROOT_DIR}/rejected_updates.json`;
export const OTA_BUNDLE_FILE_NAME = 'index.android.bundle';
export const OTA_BUNDLE_FILE_NAME_IOS = 'main.jsbundle';
export const OTA_API_BASE_URL = 'https://appapi.metadevzone.com';
export const OTA_CHECK_UPDATE_PATH = '/api/ota/public/check-update';
export const OTA_EVENTS_PATH = '/api/ota/public/events';
//# sourceMappingURL=OTAConstants.js.map