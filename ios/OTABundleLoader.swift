import Foundation

public enum OTABundleLoader {

    private static let otaBootAttemptKey = "ota_boot_attempt"
    private static let maxBootAttempts = 2

    public static func getActiveBundlePath() -> String? {
        guard let documentsDir = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            return nil
        }

        let otaRoot = documentsDir.appendingPathComponent("OTA")
        let currentFile = otaRoot.appendingPathComponent("current.json")

        guard let data = try? Data(contentsOf: currentFile) else { return nil }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let activeBundlePath = json["activeBundlePath"] as? String,
              !activeBundlePath.isEmpty else {
            return nil
        }

        let builtForNativeVersion = json["builtForNativeVersion"] as? String ?? ""
        let currentNativeVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""

        // Naya App Store build install hua hai -> purana OTA bundle ab irrelevant hai
        if !builtForNativeVersion.isEmpty && builtForNativeVersion != currentNativeVersion {
            try? FileManager.default.removeItem(at: otaRoot) // stale bundles + current.json sab clear
            resetBootAttempt()
            return nil // fallback -> naye IPA ki apni baked-in bundle load hogi
        }

        guard FileManager.default.fileExists(atPath: activeBundlePath) else {
            return nil
        }

        // ─── Native-level crash-rollback guard ───────────────────────────
        // JS engine start hone se PEHLE chalta hai, isliye JS crash ho ya
        // native crash — dono cases mein detect ho jayega.
        let defaults = UserDefaults.standard
        let attempt = defaults.integer(forKey: otaBootAttemptKey) + 1

        if attempt >= maxBootAttempts {
            // Pichli baar reportBootSuccess() kabhi nahi aaya -> crash-loop hai
            try? FileManager.default.removeItem(at: otaRoot)
            resetBootAttempt()
            return nil // fallback -> IPA ki baked-in bundle load hogi
        }

        defaults.set(attempt, forKey: otaBootAttemptKey)

        return activeBundlePath
    }

    /// JS side se OTAService.reportBootSuccess() call hone par
    /// (OTARestart ke "confirmBoot" ke zariye) ye reset hota hai.
    /// App safely launch hui — crash-counter clear karo.
    public static func resetBootAttempt() {
        UserDefaults.standard.set(0, forKey: otaBootAttemptKey)
    }
}