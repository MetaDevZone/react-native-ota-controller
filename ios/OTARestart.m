#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OTARestart, NSObject)

RCT_EXTERN_METHOD(restart)
RCT_EXTERN_METHOD(getAppVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(confirmBoot:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end