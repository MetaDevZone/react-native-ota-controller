import Foundation

public enum OTABundleLoader {

    private static let otaBootAttemptKey = "ota_boot_attempt"
    private static let maxBootAttempts = 2

    // Boot ke waqt jo bundle load hua uska version track karta hai
    private static var loadedOtaVersion: Int = 0

    public static func getActiveBundlePath() -> String? {
        guard let documentsDir = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            loadedOtaVersion = 0
            return nil
        }

        let otaRoot = documentsDir.appendingPathComponent("OTA")
        let currentFile = otaRoot.appendingPathComponent("current.json")

        guard let data = try? Data(contentsOf: currentFile) else {
            loadedOtaVersion = 0
            return nil
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let activeBundlePath = json["activeBundlePath"] as? String,
              !activeBundlePath.isEmpty else {
            loadedOtaVersion = 0
            return nil
        }

        let builtForNativeVersion = json["builtForNativeVersion"] as? String ?? ""
        let currentNativeVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let activeVersion = json["activeVersion"] as? Int ?? 0

        // Naya App Store build install hua hai -> purana OTA bundle ab irrelevant hai
        if !builtForNativeVersion.isEmpty && builtForNativeVersion != currentNativeVersion {
            try? FileManager.default.removeItem(at: otaRoot) // stale bundles + current.json sab clear
            resetBootAttempt()
            loadedOtaVersion = 0
            return nil // fallback -> naye IPA ki apni baked-in bundle load hogi
        }

        guard FileManager.default.fileExists(atPath: activeBundlePath) else {
            loadedOtaVersion = 0
            return nil
        }

        // ─── Native-level crash-rollback guard ───────────────────────────
        let defaults = UserDefaults.standard
        let attempt = defaults.integer(forKey: otaBootAttemptKey) + 1

        if attempt >= maxBootAttempts {
            try? FileManager.default.removeItem(at: otaRoot)
            resetBootAttempt()
            loadedOtaVersion = 0
            return nil
        }

        defaults.set(attempt, forKey: otaBootAttemptKey)

        // Successfully active bundle load hui -> is session ka version set karo
        loadedOtaVersion = activeVersion

        return activeBundlePath
    }

    public static func getLoadedOtaVersion() -> Int {
        return loadedOtaVersion
    }

    public static func getActiveOtaVersion() -> Int {
        guard let documentsDir = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            return 0
        }

        let currentFile = documentsDir.appendingPathComponent("OTA/current.json")
        guard let data = try? Data(contentsOf: currentFile),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return 0
        }

        let builtForNativeVersion = json["builtForNativeVersion"] as? String ?? ""
        let currentNativeVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""

        if !builtForNativeVersion.isEmpty && builtForNativeVersion != currentNativeVersion {
            return 0
        }

        return json["activeVersion"] as? Int ?? 0
    }

    public static func resetBootAttempt() {
        UserDefaults.standard.set(0, forKey: otaBootAttemptKey)
    }
}