"use strict";

import RNFS from 'react-native-fs';
class OTAHashClass {
  async sha256(filePath) {
    return RNFS.hash(filePath, 'sha256');
  }
  async verify(filePath, expectedHash) {
    if (!expectedHash) return true;
    const actualHash = await this.sha256(filePath);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  }
}
export const OTAHash = new OTAHashClass();
//# sourceMappingURL=OTAHash.js.map