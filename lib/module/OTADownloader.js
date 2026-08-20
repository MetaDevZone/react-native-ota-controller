"use strict";

import RNFS from 'react-native-fs';
import { OTA_DOWNLOAD_DIR } from "./OTAConstants.js";
const MAX_RETRIES = 2;
const CONNECTIVITY_TIMEOUT_MS = 5000;
const RETRY_WAIT_MS = 2500;
async function checkNetworkConnectivity(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function deleteFileIfExists(path) {
  try {
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  } catch (e) {
    console.warn('OTA: cleanup warning =>', e);
  }
}
async function performSingleDownload(url, destPath, onProgress) {
  const {
    promise
  } = RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    progressDivider: 5,
    progress: res => {
      const downloaded = res.bytesWritten;
      const hasKnownSize = res.contentLength > 0;
      const percentage = hasKnownSize ? Math.min(Math.round(downloaded / res.contentLength * 100), 99) : -1;
      const toMB = bytes => (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      onProgress({
        downloadedBytes: downloaded,
        totalBytes: hasKnownSize ? res.contentLength : 0,
        percentage,
        downloadedMB: toMB(downloaded),
        totalMB: hasKnownSize ? toMB(res.contentLength) : '',
        status: 'downloading'
      });
    }
  });
  const result = await promise;
  if (result.statusCode !== 200) {
    throw new Error(`OTA: download failed — HTTP ${result.statusCode} (url: ${url})`);
  }
}
async function downloadWithRetry(url, destPath, onProgress) {
  let lastError = new Error('OTA: download failed (unknown reason)');
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await deleteFileIfExists(destPath);
    const isOnline = await checkNetworkConnectivity(url);
    if (!isOnline) {
      console.log(`OTA: attempt ${attempt + 1} — network unavailable, waiting ${RETRY_WAIT_MS}ms`);
      await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_MS));
    }
    try {
      await performSingleDownload(url, destPath, onProgress);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const remaining = MAX_RETRIES - attempt;
      if (remaining > 0) {
        console.log(`OTA: attempt ${attempt + 1} failed — retrying (${remaining} left). Error: ${lastError.message}`);
      }
    }
  }
  await deleteFileIfExists(destPath);
  throw new Error(`OTA: download failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError.message}`);
}
class OTADownloaderClass {
  async ensureDownloadDir() {
    const exists = await RNFS.exists(OTA_DOWNLOAD_DIR);
    if (!exists) {
      await RNFS.mkdir(OTA_DOWNLOAD_DIR);
    }
  }
  async downloadBundle(url, version, onProgress) {
    await this.ensureDownloadDir();
    const destPath = `${OTA_DOWNLOAD_DIR}/bundle${version}.zip`;
    await downloadWithRetry(url, destPath, onProgress);
    return destPath;
  }
}
export const OTADownloader = new OTADownloaderClass();
//# sourceMappingURL=OTADownloader.js.map