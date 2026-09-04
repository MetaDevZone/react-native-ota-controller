import React, { useEffect, useRef } from 'react';
import { OTA, OTAError } from './OTAService';
import type { OTAChannel } from './OTATypes';

export interface OTAProviderProps {
  apiKey: string;
  channel?: OTAChannel;
  disableInDev?: boolean;
  children?: React.ReactNode;
}

/**
 * Root configuration component for the OTALink SDK.
 * Mount this once in your App.js:
 *
 * Way 1 (Standalone):
 *   <NavigationContainer>...</NavigationContainer>
 *   <OTAProvider apiKey="ota_live_..." channel="production" />
 *
 * Way 2 (Wrapper):
 *   <OTAProvider apiKey="ota_live_..." channel="production">
 *     <NavigationContainer>...</NavigationContainer>
 *   </OTAProvider>
 */
export function OTAProvider(props: OTAProviderProps): React.ReactNode {
  const { apiKey, channel, disableInDev, children } = props;

  useEffect(() => {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      console.warn(
        'OTAProvider: apiKey is required. Pass a valid API key from https://otalink.metadevzone.com/.'
      );
      return;
    }

    // 1. Configure global credentials & environment
    OTA.configure({
      apiKey: apiKey.trim(),
      ...(channel ? { channel: channel.trim() as OTAChannel } : {}),
      ...(disableInDev !== undefined ? { disableInDev } : {}),
    });

    // 2. Report boot confirmation & post-restart first-run install telemetry
    OTA.reportBootSuccess().catch((err) => {
      console.warn('OTAProvider: reportBootSuccess error =>', err?.message ?? err);
    });
  }, [apiKey, channel, disableInDev]);

  return children ? <>{children}</> : null;
}

/**
 * Backward-compatible alias for <OTAProvider />
 */
export const OTARoot = OTAProvider;
