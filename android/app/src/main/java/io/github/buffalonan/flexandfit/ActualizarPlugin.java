package io.github.buffalonan.flexandfit;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Updates the app from its GitHub releases (web/actualizar.js finds the newest one).
 * The app never downloads or installs APKs itself: an app that does (REQUEST_INSTALL_PACKAGES) is what
 * Google Play Protect blocked as harmful. It opens the release's APK link in the browser instead, which
 * downloads it and hands it to Android's installer; signed with the same key, it installs over this one.
 * JS: Capacitor.registerPlugin("Actualizar")
 *   .version() → { codigo, nombre, depuracion }: the installed versionCode and versionName, and whether it's a debug build.
 *   .abrir({ url }) → {}: opens an APK link of this repo's releases (no other URL) in the browser.
 */
@CapacitorPlugin(name = "Actualizar")
public class ActualizarPlugin extends Plugin {
    private static final String DESCARGAS = "https://github.com/buffalonan/flex-and-fit/releases/download/";

    @SuppressWarnings("deprecation") // versionCode is the only way before Android 9.
    private static long codigo(PackageInfo p) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode;
    }

    @PluginMethod
    public void version(PluginCall call) {
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("codigo", codigo(p));
            r.put("nombre", p.versionName);
            r.put("depuracion", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
            call.resolve(r);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("No encuentro la versión instalada.");
        }
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || !url.startsWith(DESCARGAS) || url.contains("..")) {
            call.reject("Solo abro las versiones publicadas en GitHub.", "url");
            return;
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No se pudo abrir el navegador.", "navegador");
        }
    }
}
