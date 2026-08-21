import Foundation
import React

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
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        let otaVersion = OTABundleLoader.getLoadedOtaVersion()
        return [
            "appVersion": appVersion,
            "otaVersion": otaVersion
        ]
    }

    @objc
    func restart() {
        DispatchQueue.main.async {
            guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let window = windowScene.windows.first else {
                exit(0)
            }
            exit(0)
        }
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