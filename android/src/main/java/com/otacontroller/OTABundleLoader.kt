package com.otacontroller

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

    // Boot ke waqt jo bundle load hua uska version track karta hai
    private var loadedOtaVersion: Int = 0

    fun getActiveBundlePath(context: Context): String? {
        return try {
            val otaRoot = File(context.filesDir, OTA_ROOT_DIR)
            val currentFile = File(otaRoot, CURRENT_FILE)
            if (!currentFile.exists()) {
                loadedOtaVersion = 0
                return null
            }

            val json = JSONObject(currentFile.readText())
            val activeBundlePath = json.optString("activeBundlePath", "")
            val builtForNativeVersion = json.optString("builtForNativeVersion", "")
            val activeVersion = json.optInt("activeVersion", 0)

            if (activeBundlePath.isEmpty()) {
                loadedOtaVersion = 0
                return null
            }

            val currentNativeVersion = getCurrentNativeVersion(context)

            // Naya Play Store APK install hua hai -> purana OTA bundle ab irrelevant hai
            if (builtForNativeVersion.isNotEmpty() && builtForNativeVersion != currentNativeVersion) {
                otaRoot.deleteRecursively() // stale bundles + current.json sab clear
                resetBootAttempt(context)
                loadedOtaVersion = 0
                return null // fallback -> naye APK ki apni baked-in bundle load hogi
            }

            val bundleFile = File(activeBundlePath)
            if (!bundleFile.exists()) {
                loadedOtaVersion = 0
                return null
            }

            // ─── Native-level crash-rollback guard ───────────────────────────
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val attempt = prefs.getInt(KEY_BOOT_ATTEMPT, 0) + 1

            if (attempt >= MAX_BOOT_ATTEMPTS) {
                otaRoot.deleteRecursively()
                resetBootAttempt(context)
                loadedOtaVersion = 0
                return null
            }

            prefs.edit().putInt(KEY_BOOT_ATTEMPT, attempt).apply()

            // Successfully active bundle load hui -> is session ka version set karo
            loadedOtaVersion = activeVersion

            activeBundlePath
        } catch (e: Exception) {
            loadedOtaVersion = 0
            null
        }
    }

    /**
     * Current running session me jo bundle actually load hui hai uska version return karta hai.
     */
    fun getLoadedOtaVersion(): Int {
        return loadedOtaVersion
    }

    /**
     * Storage me jo activeVersion likha hai wo return karta hai.
     */
    fun getActiveOtaVersion(context: Context): Int {
        return try {
            val otaRoot = File(context.filesDir, OTA_ROOT_DIR)
            val currentFile = File(otaRoot, CURRENT_FILE)
            if (!currentFile.exists()) return 0

            val json = JSONObject(currentFile.readText())
            val builtForNativeVersion = json.optString("builtForNativeVersion", "")
            val currentNativeVersion = getCurrentNativeVersion(context)

            if (builtForNativeVersion.isNotEmpty() && builtForNativeVersion != currentNativeVersion) {
                return 0
            }

            json.optInt("activeVersion", 0)
        } catch (e: Exception) {
            0
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
