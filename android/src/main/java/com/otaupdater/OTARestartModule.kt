package com.otaupdater

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

    @ReactMethod
    fun restart() {
        val context = reactApplicationContext
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(intent)
        Process.killProcess(Process.myPid())
        exitProcess(0)
    }

    // Play Store wala current app version (e.g. "2.4.0") return karta hai
    @ReactMethod
    fun getAppVersion(promise: Promise) {
        try {
            val context = reactApplicationContext
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            promise.resolve(pInfo.versionName)
        } catch (e: Exception) {
            promise.reject("OTA_VERSION_ERROR", e)
        }
    }

    // App safely launch ho gayi — native boot-attempt counter reset karo.
    // JS side OTAService.reportBootSuccess() isko call karta hai.
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