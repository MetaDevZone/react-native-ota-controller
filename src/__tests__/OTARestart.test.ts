import { NativeModules } from 'react-native';

describe('OTARestart module tests', () => {
  const originalModules = { ...NativeModules };

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    Object.assign(NativeModules, originalModules);
  });

  describe('getAppId', () => {
    it('should return appId when OTARestart.getAppId() is a function returning a string', () => {
      NativeModules.OTARestart = {
        getAppId: jest.fn().mockReturnValue('com.example.testapp'),
      };
      const { getAppId } = require('../OTARestart');
      expect(getAppId()).toBe('com.example.testapp');
    });

    it('should fallback to constants.appId if getAppId() throws', () => {
      NativeModules.OTARestart = {
        getAppId: jest.fn().mockImplementation(() => {
          throw new Error('native crash');
        }),
        appId: 'com.example.fallback',
      };
      const { getAppId } = require('../OTARestart');
      expect(getAppId()).toBe('com.example.fallback');
    });

    it('should fallback to constants.appId if getAppId() returns a non-string', () => {
      NativeModules.OTARestart = {
        getAppId: jest.fn().mockReturnValue(12345 as any),
        appId: 'com.example.fallback',
      };
      const { getAppId } = require('../OTARestart');
      expect(getAppId()).toBe('com.example.fallback');
    });

    it('should fallback to constants.appId via getConstants()', () => {
      NativeModules.OTARestart = {
        getConstants: () => ({ appId: 'com.example.constantapp' }),
      };
      const { getAppId } = require('../OTARestart');
      expect(getAppId()).toBe('com.example.constantapp');
    });

    it('should return empty string if no appId is available', () => {
      NativeModules.OTARestart = {};
      const { getAppId } = require('../OTARestart');
      expect(getAppId()).toBe('');
    });
  });

  describe('getAppVersion', () => {
    it('should return appVersion when OTARestart.getAppVersion() is a function returning a string', () => {
      NativeModules.OTARestart = {
        getAppVersion: jest.fn().mockReturnValue('2.5.1'),
      };
      const { getAppVersion } = require('../OTARestart');
      expect(getAppVersion()).toBe('2.5.1');
    });

    it('should fallback to constants.appVersion if getAppVersion() throws', () => {
      NativeModules.OTARestart = {
        getAppVersion: jest.fn().mockImplementation(() => {
          throw new Error('version error');
        }),
        appVersion: '1.9.0',
      };
      const { getAppVersion } = require('../OTARestart');
      expect(getAppVersion()).toBe('1.9.0');
    });

    it('should fallback to constants.appVersion if getAppVersion() returns non-string', () => {
      NativeModules.OTARestart = {
        getAppVersion: jest.fn().mockReturnValue(null as any),
        appVersion: '1.9.0',
      };
      const { getAppVersion } = require('../OTARestart');
      expect(getAppVersion()).toBe('1.9.0');
    });

    it('should fallback to constants.appVersion via getConstants()', () => {
      NativeModules.OTARestart = {
        getConstants: () => ({ appVersion: '3.0.0' }),
      };
      const { getAppVersion } = require('../OTARestart');
      expect(getAppVersion()).toBe('3.0.0');
    });

    it('should return "unknown" if no appVersion is available', () => {
      NativeModules.OTARestart = {};
      const { getAppVersion } = require('../OTARestart');
      expect(getAppVersion()).toBe('unknown');
    });
  });

  describe('getOtaVersion', () => {
    it('should freeze and return otaVersion from OTARestart.getOtaVersion()', () => {
      NativeModules.OTARestart = {
        getOtaVersion: jest.fn().mockReturnValue(4),
      };
      const { getOtaVersion } = require('../OTARestart');
      expect(getOtaVersion()).toBe(4);
    });

    it('should freeze and return otaVersion from constants.otaVersion if getOtaVersion() throws', () => {
      NativeModules.OTARestart = {
        getOtaVersion: jest.fn().mockImplementation(() => {
          throw new Error('native failure');
        }),
        otaVersion: '3',
      };
      const { getOtaVersion } = require('../OTARestart');
      expect(getOtaVersion()).toBe(3);
    });

    it('should return 0 when no otaVersion is defined', () => {
      NativeModules.OTARestart = {};
      const { getOtaVersion } = require('../OTARestart');
      expect(getOtaVersion()).toBe(0);
    });
  });

  describe('restartApp', () => {
    it('should call OTARestart.restart() if available', () => {
      const restartMock = jest.fn();
      NativeModules.OTARestart = {
        restart: restartMock,
      };
      const { restartApp } = require('../OTARestart');
      restartApp();
      expect(restartMock).toHaveBeenCalledTimes(1);
    });

    it('should log a console warning if restart is not linked', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      NativeModules.OTARestart = {};
      const { restartApp } = require('../OTARestart');
      restartApp();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('OTARestart native module not linked')
      );
      warnSpy.mockRestore();
    });
  });

  describe('confirmNativeBootSuccess', () => {
    it('should call OTARestart.confirmBoot() and resolve', async () => {
      const confirmMock = jest.fn().mockResolvedValue(undefined);
      NativeModules.OTARestart = {
        confirmBoot: confirmMock,
      };
      const { confirmNativeBootSuccess } = require('../OTARestart');
      await confirmNativeBootSuccess();
      expect(confirmMock).toHaveBeenCalledTimes(1);
    });

    it('should catch and log warning if confirmBoot rejects', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      NativeModules.OTARestart = {
        confirmBoot: jest.fn().mockRejectedValue(new Error('boot failed')),
      };
      const { confirmNativeBootSuccess } = require('../OTARestart');
      await confirmNativeBootSuccess();
      expect(warnSpy).toHaveBeenCalledWith(
        'OTA: confirmBoot failed =>',
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });

    it('should log warning if confirmBoot is not linked', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      NativeModules.OTARestart = {};
      const { confirmNativeBootSuccess } = require('../OTARestart');
      await confirmNativeBootSuccess();
      expect(warnSpy).toHaveBeenCalledWith(
        'OTARestart.confirmBoot not linked'
      );
      warnSpy.mockRestore();
    });
  });
});
