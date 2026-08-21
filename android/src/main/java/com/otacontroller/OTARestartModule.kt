package com.otacontroller

import android.content.Intent
import android.os.Process
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.system.exitProcess

class OTARestartModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "OTARestart"

    override fun initialize() {
        super.initialize()
        // JS context successfully created -> reset crash-rollback counter automatically
        try {
            OTABundleLoader.resetBootAttempt(reactApplicationContext)
        } catch (_: Exception) {}
    }

    override fun getConstants(): Map<String, Any?> {
        val context = reactApplicationContext
        val versionName = try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
        // Current loaded bundle ka version return karega
        val otaVersion = OTABundleLoader.getLoadedOtaVersion()
        return mapOf(
            "appVersion" to versionName,
            "otaVersion" to otaVersion
        )
    }

    @ReactMethod
    fun restart() {
        val context = reactApplicationContext
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(intent)
        Process.killProcess(Process.myPid())
        exitProcess(0)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getAppVersion(): String {
        return try {
            val context = reactApplicationContext
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getOtaVersion(): Int {
        return OTABundleLoader.getLoadedOtaVersion()
    }

    @ReactMethod
    fun confirmBoot(promise: Promise) {
        try {
            OTABundleLoader.resetBootAttempt(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OTA_CONFIRM_BOOT_ERROR", e)
        }
    }
}
