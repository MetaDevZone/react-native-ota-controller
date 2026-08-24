#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OTARestart, NSObject)

RCT_EXTERN_METHOD(restart)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(getAppId)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(getAppVersion)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(getOtaVersion)

RCT_EXTERN_METHOD(confirmBoot:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end