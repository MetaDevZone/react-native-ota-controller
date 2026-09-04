import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { OTAProvider, OTARoot } from '../OTAProvider';
import { OTA } from '../OTAService';

jest.mock('../OTAService', () => ({
  OTA: {
    configure: jest.fn(),
    reportBootSuccess: jest.fn().mockResolvedValue(undefined),
  },
  OTAError: class MockOTAError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

describe('<OTAProvider /> Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should configure apiKey and call reportBootSuccess on mount as a standalone tag', async () => {
    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAProvider, {
          apiKey: 'ota_live_provider_key',
        })
      );
    });

    expect(OTA.configure).toHaveBeenCalledWith({
      apiKey: 'ota_live_provider_key',
    });
    expect(OTA.reportBootSuccess).toHaveBeenCalled();
  });

  it('should render children when used as a wrapper', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          OTAProvider,
          { apiKey: 'ota_live_key' },
          React.createElement('test-child', null, 'Hello World')
        )
      );
    });

    expect(renderer.toJSON().children).toContain('Hello World');
    expect(OTA.configure).toHaveBeenCalledWith({ apiKey: 'ota_live_key' });
  });

  it('should support OTARoot alias', () => {
    expect(OTARoot).toBe(OTAProvider);
  });

  it('should warn if apiKey is empty or missing', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAProvider, {
          apiKey: '   ',
        })
      );
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('apiKey is required')
    );
    expect(OTA.configure).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle errors in reportBootSuccess gracefully without crashing component', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (OTA.reportBootSuccess as jest.Mock).mockRejectedValueOnce(
      new Error('Boot error')
    );

    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(OTAProvider, {
          apiKey: 'ota_live_key',
        })
      );
    });

    expect(OTA.configure).toHaveBeenCalledWith({ apiKey: 'ota_live_key' });
    consoleSpy.mockRestore();
  });
});
