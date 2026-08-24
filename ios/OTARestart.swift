import Foundation
import React

// Link to React Native's C reload function
@_silgen_name("RCTTriggerReloadCommandListeners")
func RCTTriggerReloadCommandListeners(_ reason: NSString)

@objc(OTARestart)
class OTARestart: NSObject, RCTBridgeModule {

    static func moduleName() -> String! {
        return "OTARestart"
    }

    static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override init() {
        super.init()
        // JS engine booted successfully -> reset crash rollback counter automatically
        OTABundleLoader.resetBootAttempt()
    }

    @objc
    func constantsToExport() -> [AnyHashable: Any]! {
        let appId = Bundle.main.bundleIdentifier ?? ""
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        let otaVersion = OTABundleLoader.getLoadedOtaVersion()
        return [
            "appId": appId,
            "appVersion": appVersion,
            "otaVersion": otaVersion
        ]
    }

    @objc
    func restart() {
        DispatchQueue.main.async {
            RCTTriggerReloadCommandListeners("OTARestart: reload" as NSString)
        }
    }

    @objc
    func getAppId() -> String {
        return Bundle.main.bundleIdentifier ?? ""
    }

    @objc
    func getAppVersion() -> String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    }

    @objc
    func getOtaVersion() -> NSNumber {
        return NSNumber(value: OTABundleLoader.getLoadedOtaVersion())
    }

    @objc
    func confirmBoot(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        OTABundleLoader.resetBootAttempt()
        resolve(true)
    }
}