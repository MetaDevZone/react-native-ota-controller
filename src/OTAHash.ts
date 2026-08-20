import RNFS from 'react-native-fs';

class OTAHashClass {
  async sha256(filePath: string): Promise<string> {
    return RNFS.hash(filePath, 'sha256');
  }

  async verify(filePath: string, expectedHash: string): Promise<boolean> {
    if (!expectedHash) return true;
    const actualHash = await this.sha256(filePath);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  }
}

export const OTAHash = new OTAHashClass();
