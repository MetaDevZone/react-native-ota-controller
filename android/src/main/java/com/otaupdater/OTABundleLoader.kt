package com.otaupdater

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * RNFS.DocumentDirectoryPath (Android) === context.filesDir
 * Isi wajah se JS aur Native dono same current.json ko dekhte hain.
 */
object OTABundleLoader {

    private const val OTA_ROOT_DIR = "OTA"
    private const val CURRENT_FILE = "current.json"
    private const val PREFS_NAME = "ota_updater_prefs"
    private const val KEY_BOOT_ATTEMPT = "ota_boot_attempt"
    private const val MAX_BOOT_ATTEMPTS = 2

    fun getActiveBundlePath(context: Context): String? {
        return try {
            val otaRoot = File(context.filesDir, OTA_ROOT_DIR)
            val currentFile = File(otaRoot, CURRENT_FILE)
            if (!currentFile.exists()) return null

            val json = JSONObject(currentFile.readText())
            val activeBundlePath = json.optString("activeBundlePath", "")
            val builtForNativeVersion = json.optString("builtForNativeVersion", "")
            if (activeBundlePath.isEmpty()) return null

            val currentNativeVersion = getCurrentNativeVersion(context)

            // Naya Play Store APK install hua hai -> purana OTA bundle ab irrelevant hai
            if (builtForNativeVersion.isNotEmpty() && builtForNativeVersion != currentNativeVersion) {
                otaRoot.deleteRecursively() // stale bundles + current.json sab clear
                resetBootAttempt(context)
                return null // fallback -> naye APK ki apni baked-in bundle load hogi
            }

            val bundleFile = File(activeBundlePath)
            if (!bundleFile.exists()) return null

            // ─── Native-level crash-rollback guard ───────────────────────────
            // JS engine start hone se PEHLE chalta hai, isliye JS crash ho ya
            // native crash — dono cases mein detect ho jayega.
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val attempt = prefs.getInt(KEY_BOOT_ATTEMPT, 0) + 1

            if (attempt >= MAX_BOOT_ATTEMPTS) {
                // Pichli baar(on) reportBootSuccess() kabhi nahi aaya -> crash-loop hai
                otaRoot.deleteRecursively()
                resetBootAttempt(context)
                return null // fallback -> APK ki baked-in bundle load hogi
            }

            prefs.edit().putInt(KEY_BOOT_ATTEMPT, attempt).apply()

            activeBundlePath
        } catch (e: Exception) {
            // current.json corrupt ya missing hui -> APK ki bundled JS load hogi
            null
        }
    }

    /**
     * JS side se OTAService.reportBootSuccess() call hone par
     * (OTARestartModule ke "confirmBoot" ke zariye) ye reset hota hai.
     * App safely launch hui — crash-counter clear karo.
     */
    fun resetBootAttempt(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_BOOT_ATTEMPT, 0).apply()
    }

    private fun getCurrentNativeVersion(context: Context): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
        } catch (e: Exception) {
            ""
        }
    }
}