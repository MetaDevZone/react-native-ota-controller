import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { OTAController } from '../OTAController';
import { OTA } from '../OTAService';

jest.mock('../OTAService', () => ({
  OTA: {
    reportBootSuccess: jest.fn().mockResolvedValue(undefined),
    downloadAndApplyUpdate: jest.fn(),
    getLastCheckResult: jest.fn().mockReturnValue(null),
    checkForUpdate: jest.fn(),
  },
  OTAError: class MockOTAError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
    toPayload() {
      return { code: this.code, message: this.message };
    }
  },
}));

describe('<OTAController /> Component (Release prop, Zero duplicate check)', () => {
  const mockRelease = {
    otaVersion: 2,
    bundleUrl: 'https://example.com/bundle.zip',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (OTA.getLastCheckResult as jest.Mock).mockReturnValue(null);
  });

  it('should emit error if release is not provided and no cached check exists', async () => {
    const onError = jest.fn();
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAController, { onError })
      );
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DOWNLOAD_FAILED',
        message: expect.stringContaining('No release provided'),
      })
    );
    expect(OTA.checkForUpdate).not.toHaveBeenCalled();
    expect(OTA.downloadAndApplyUpdate).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should download release directly without calling checkForUpdate', async () => {
    jest.useFakeTimers();

    (OTA.downloadAndApplyUpdate as jest.Mock).mockResolvedValue({
      updated: true,
      version: 2,
    });

    const onProgress = jest.fn();
    const onStateChange = jest.fn();
    const onError = jest.fn();

    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAController, {
          release: mockRelease,
          autoRestart: true,
          onProgress,
          onStateChange,
          onError,
        })
      );
    });

    expect(OTA.reportBootSuccess).toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith('checking');
    // Ensure it NEVER called checkForUpdate()!
    expect(OTA.checkForUpdate).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(OTA.downloadAndApplyUpdate).toHaveBeenCalledWith({
      release: mockRelease,
      autoRestart: true,
      onError: expect.any(Function),
      onProgress: expect.any(Function),
    });

    jest.useRealTimers();
  });

  it('should use cached release from checkForUpdate when release prop is omitted', async () => {
    jest.useFakeTimers();

    (OTA.getLastCheckResult as jest.Mock).mockReturnValue({
      updateAvailable: true,
      release: mockRelease,
    });

    (OTA.downloadAndApplyUpdate as jest.Mock).mockResolvedValue({
      updated: true,
      version: 2,
    });

    await act(async () => {
      ReactTestRenderer.create(React.createElement(OTAController, {}));
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(OTA.downloadAndApplyUpdate).toHaveBeenCalledWith({
      release: mockRelease,
      autoRestart: true,
      onError: expect.any(Function),
      onProgress: expect.any(Function),
    });
    expect(OTA.checkForUpdate).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should forward progress and state changes to callbacks object', async () => {
    jest.useFakeTimers();

    let capturedProgressCallback: any;
    (OTA.downloadAndApplyUpdate as jest.Mock).mockImplementation(
      (options: any) => {
        capturedProgressCallback = options.onProgress;
        return Promise.resolve({ updated: true, version: 3 });
      }
    );

    const callbacksOnProgress = jest.fn();
    const callbacksOnStateChange = jest.fn();

    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAController, {
          release: mockRelease,
          callbacks: {
            onProgress: callbacksOnProgress,
            onStateChange: callbacksOnStateChange,
          },
        })
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(capturedProgressCallback).toBeDefined();

    act(() => {
      capturedProgressCallback({
        downloadedBytes: 1048576,
        totalBytes: 2097152,
        percentage: 50,
        downloadedMB: '1.00',
        totalMB: '2.00',
        status: 'downloading',
      });
    });

    expect(callbacksOnStateChange).toHaveBeenCalledWith('downloading');
    expect(callbacksOnProgress).toHaveBeenCalledWith({
      downloaded: 1048576,
      fullSize: 2097152,
      percentage: 50,
      downloadedMB: '1.00',
      totalMB: '2.00',
    });

    jest.useRealTimers();
  });

  it('should forward errors to onError callback and log warning', async () => {
    jest.useFakeTimers();
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    let capturedErrorCallback: any;
    (OTA.downloadAndApplyUpdate as jest.Mock).mockImplementation(
      (options: any) => {
        capturedErrorCallback = options.onError;
        return Promise.reject(new Error('Download failed'));
      }
    );

    const onError = jest.fn();

    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAController, {
          release: mockRelease,
          onError,
        })
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(capturedErrorCallback).toBeDefined();

    act(() => {
      capturedErrorCallback({
        code: 'DOWNLOAD_FAILED',
        message: 'Failed to download zip',
      });
    });

    expect(onError).toHaveBeenCalledWith({
      code: 'DOWNLOAD_FAILED',
      message: 'Failed to download zip',
    });

    consoleSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should cancel operations and not emit callbacks if unmounted', async () => {
    jest.useFakeTimers();

    let capturedProgressCallback: any;
    (OTA.downloadAndApplyUpdate as jest.Mock).mockImplementation(
      (options: any) => {
        capturedProgressCallback = options.onProgress;
        return new Promise(() => {}); // never resolves
      }
    );

    const onProgress = jest.fn();
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(OTAController, {
          release: mockRelease,
          onProgress,
        })
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Unmount
    act(() => {
      renderer.unmount();
    });

    // Fire progress after unmount
    act(() => {
      capturedProgressCallback?.({
        downloadedBytes: 100,
        totalBytes: 100,
        percentage: 100,
        downloadedMB: '0.1',
        totalMB: '0.1',
        status: 'downloaded',
      });
    });

    expect(onProgress).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
