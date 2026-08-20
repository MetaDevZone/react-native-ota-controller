package com.otaupdater

import android.content.Context
import com.facebook.react.ReactPackage

/**
 * OTAUpdater — public helper object.
 * Consumer app isko function-call se use karta hai — koi class inheritance
 * nahi chahiye, isliye kisi bhi doosri base class (Firebase, custom SDKs, etc.)
 * ke saath conflict nahi hota.
 */
object OTAUpdater {

    /**
     * MainApplication.kt ke getJSBundleFile() ke andar call karo.
     * Active OTA bundle ka path return karta hai, ya null agar
     * koi OTA bundle nahi hai (default APK bundle load hogi).
     */
    @JvmStatic
    fun resolveBundlePath(context: Context): String? {
        return OTABundleLoader.getActiveBundlePath(context)
    }

    /**
     * MainApplication.kt ke getPackages() list mein add karo.
     * restart() aur getAppVersion() JS bridge calls ke liye zaroori hai.
     */
    @JvmStatic
    fun getRestartPackage(): ReactPackage {
        return OTARestartPackage()
    }
}