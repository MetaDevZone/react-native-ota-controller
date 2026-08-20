import Foundation

/**
 * OTAUpdater — public helper enum.
 * Consumer app isko function-call se use karta hai — koi class inheritance
 * nahi chahiye, isliye kisi bhi doosri base class ke saath conflict nahi hota.
 */
public enum OTAUpdater {

    /**
     * AppDelegate.swift ke sourceURL(for:) ke andar call karo.
     * Active OTA bundle ka URL return karta hai, ya nil agar
     * koi OTA bundle nahi hai (default main.jsbundle load hogi).
     */
    public static func resolveBundlePath() -> URL? {
        guard let path = OTABundleLoader.getActiveBundlePath() else {
            return nil
        }
        return URL(fileURLWithPath: path)
    }
}