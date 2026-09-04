import RNFS from 'react-native-fs';
import { OTADownloader } from '../OTADownloader';
import { OTA_DOWNLOAD_DIR } from '../OTAConstants';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  downloadFile: jest.fn(),
}));

describe('OTADownloader Module Tests', () => {
  const originalFetch = global.fetch;
  const mockUrl = 'https://example.com/bundle.zip';
  const expectedDestPath = `${OTA_DOWNLOAD_DIR}/update.zip`;

  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should create OTA_DOWNLOAD_DIR if it does not exist', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
      if (path === OTA_DOWNLOAD_DIR) return false;
      return false;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    (RNFS.downloadFile as jest.Mock).mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const progressCb = jest.fn();
    const dest = await OTADownloader.downloadBundle(mockUrl, progressCb);

    expect(RNFS.mkdir).toHaveBeenCalledWith(OTA_DOWNLOAD_DIR);
    expect(dest).toBe(expectedDestPath);
  });

  it('should download successfully on the first attempt with progress events', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    (RNFS.downloadFile as jest.Mock).mockImplementation((options: any) => {
      // Trigger begin and progress callbacks
      options.begin({ contentLength: 10485760 });
      options.progress({ bytesWritten: 5242880, contentLength: 10485760 });
      return {
        promise: Promise.resolve({ statusCode: 200 }),
      };
    });

    const progressReports: any[] = [];
    const progressCb = jest.fn((p) => progressReports.push(p));

    const dest = await OTADownloader.downloadBundle(mockUrl, progressCb);

    expect(dest).toBe(expectedDestPath);
    expect(RNFS.unlink).toHaveBeenCalledWith(expectedDestPath);
    expect(progressReports.length).toBe(2);

    expect(progressReports[0]).toEqual({
      downloadedBytes: 0,
      totalBytes: 10485760,
      percentage: 0,
      downloadedMB: '0.0 MB',
      totalMB: '10.0 MB',
      status: 'downloading',
    });

    expect(progressReports[1]).toEqual({
      downloadedBytes: 5242880,
      totalBytes: 10485760,
      percentage: 50,
      downloadedMB: '5.0 MB',
      totalMB: '10.0 MB',
      status: 'downloading',
    });
  });

  it('should handle unknown content-length in begin and progress callbacks', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    (RNFS.downloadFile as jest.Mock).mockImplementation((options: any) => {
      options.begin({ contentLength: 0 });
      options.progress({ bytesWritten: 2097152, contentLength: 0 });
      return {
        promise: Promise.resolve({ statusCode: 200 }),
      };
    });

    const progressReports: any[] = [];
    const progressCb = jest.fn((p) => progressReports.push(p));

    await OTADownloader.downloadBundle(mockUrl, progressCb);

    expect(progressReports[0].totalBytes).toBe(0);
    expect(progressReports[0].totalMB).toBe('');
    expect(progressReports[1].percentage).toBe(-1);
    expect(progressReports[1].downloadedMB).toBe('2.0 MB');
  });

  it('should retry when download HTTP status is non-200 and succeed on second attempt', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    let attemptCount = 0;
    (RNFS.downloadFile as jest.Mock).mockImplementation(() => {
      attemptCount++;
      if (attemptCount === 1) {
        return {
          promise: Promise.resolve({ statusCode: 500 }),
        };
      }
      return {
        promise: Promise.resolve({ statusCode: 200 }),
      };
    });

    const progressCb = jest.fn();
    const downloadPromise = OTADownloader.downloadBundle(mockUrl, progressCb);

    const dest = await downloadPromise;
    expect(dest).toBe(expectedDestPath);
    expect(attemptCount).toBe(2);

    jest.useRealTimers();
  });

  it('should wait when network is offline and retry', async () => {
    jest.useFakeTimers();

    let fetchCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      fetchCount++;
      if (fetchCount === 1) {
        throw new Error('No internet');
      }
      return { ok: true, status: 200 };
    });

    (RNFS.downloadFile as jest.Mock).mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const progressCb = jest.fn();
    const downloadPromise = OTADownloader.downloadBundle(mockUrl, progressCb);

    // Fast forward retry wait timer
    await jest.runAllTimersAsync();

    const dest = await downloadPromise;
    expect(dest).toBe(expectedDestPath);
    expect(fetchCount).toBeGreaterThanOrEqual(1);

    jest.useRealTimers();
  });

  it('should throw error after exhausting MAX_RETRIES (3 attempts total)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    (RNFS.downloadFile as jest.Mock).mockReturnValue({
      promise: Promise.resolve({ statusCode: 404 }),
    });

    const progressCb = jest.fn();

    await expect(
      OTADownloader.downloadBundle(mockUrl, progressCb)
    ).rejects.toThrow('OTA: download failed after 3 attempts');

    expect(RNFS.downloadFile).toHaveBeenCalledTimes(3);
  });

  it('should handle deleteFileIfExists warnings gracefully if unlink throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.unlink as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    (RNFS.downloadFile as jest.Mock).mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const dest = await OTADownloader.downloadBundle(mockUrl, jest.fn());
    expect(dest).toBe(expectedDestPath);
    expect(warnSpy).toHaveBeenCalledWith('OTA: cleanup warning =>', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('should pass custom headers (e.g. x-ota-app-key) to RNFS.downloadFile and fetch', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    (RNFS.downloadFile as jest.Mock).mockReturnValue({
      promise: Promise.resolve({ statusCode: 200 }),
    });

    const headers = { 'x-ota-app-key': 'ota_live_key_test' };
    await OTADownloader.downloadBundle(mockUrl, jest.fn(), headers);

    expect(global.fetch).toHaveBeenCalledWith(
      mockUrl,
      expect.objectContaining({
        method: 'HEAD',
        headers,
      })
    );

    expect(RNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUrl: mockUrl,
        headers,
      })
    );
  });
});
