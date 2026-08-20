import Foundation
import React

@objc(OTARestart)
class OTARestart: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  // iOS App Store guidelines process ko forcefully kill/relaunch karne ki ijazat nahi dete
  // (Android jaisa Process.killProcess yahan use nahi kar sakte).
  // Sahi tareeqa: JS bundle ko in-place reload karna, jaise dev mode me "Reload" button.
  @objc
  func restart() {
    DispatchQueue.main.async {
      RCTTriggerReloadCommandListeners("OTA update applied")
    }
  }

  // App Store wala current app version (e.g. "2.4.0") return karta hai
  @objc
  func getAppVersion(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
      resolve(version)
    } else {
      reject("OTA_VERSION_ERROR", "Could not read app version", nil)
    }
  }

  // App safely launch ho gayi — native boot-attempt counter reset karo.
  // JS side OTAService.reportBootSuccess() isko call karta hai.
  @objc
  func confirmBoot(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    OTABundleLoader.resetBootAttempt()
    resolve(true)
  }
}