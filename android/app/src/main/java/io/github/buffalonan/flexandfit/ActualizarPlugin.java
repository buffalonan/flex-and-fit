package io.github.buffalonan.flexandfit;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

/**
 * Updates the app from its GitHub releases (web/actualizar.js finds the newest one).
 * JS: Capacitor.registerPlugin("Actualizar")
 *   .version() → { codigo, nombre, depuracion }: the installed versionCode and versionName, and whether it's a debug build.
 *   .descargar({ url }) → { codigo, nombre }: downloads the APK (only from this repo's releases) into the cache,
 *     with "progreso" events { bytes, total }, and checks it is this app, newer, and signed with the same key,
 *     so Android installs it over the current one and keeps the data.
 *   .permiso() → { puede }: whether Android lets this app install APKs ("Instalar apps desconocidas").
 *   .instalar() → { estado: "abierto" } (Android's installer is open) or { estado: "permiso" } (the settings
 *     screen to allow it is open; call again when the app comes back).
 */
@CapacitorPlugin(name = "Actualizar")
public class ActualizarPlugin extends Plugin {
    private static final String DESCARGAS = "https://github.com/buffalonan/flex-and-fit/releases/download/";
    private static final String MIME = "application/vnd.android.package-archive";
    private static final long MAXIMO = 200L * 1024 * 1024;

    private File apk() {
        return new File(new File(getContext().getCacheDir(), "actualizacion"), "flex-and-fit.apk");
    }

    @SuppressWarnings("deprecation") // versionCode is the only way before Android 9.
    private static long codigo(PackageInfo p) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode;
    }

    @SuppressWarnings("deprecation") // GET_SIGNATURES and signatures are the only way before Android 9.
    private static Set<String> firmas(PackageInfo p) {
        Set<String> s = new HashSet<>();
        Signature[] lista = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (p.signingInfo != null) lista = p.signingInfo.getApkContentsSigners();
        } else {
            lista = p.signatures;
        }
        if (lista != null) for (Signature f : lista) s.add(f.toCharsString());
        return s;
    }

    @SuppressWarnings("deprecation")
    private static int banderas() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }

    private PackageInfo instalada() throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), banderas());
    }

    @PluginMethod
    public void version(PluginCall call) {
        try {
            PackageInfo p = instalada();
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
    public void permiso(PluginCall call) {
        JSObject r = new JSObject();
        r.put("puede", puedeInstalar());
        call.resolve(r);
    }

    private boolean puedeInstalar() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || !url.startsWith(DESCARGAS) || url.contains("..")) {
            call.reject("Solo descargo las versiones publicadas en GitHub.", "url");
            return;
        }
        new Thread(() -> {
            File destino = apk();
            File parcial = new File(destino.getParentFile(), "descarga.part");
            try {
                File dir = destino.getParentFile();
                if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new IOException("No puedo escribir en la caché.");
                bajar(url, parcial);
                PackageManager pm = getContext().getPackageManager();
                PackageInfo nueva = pm.getPackageArchiveInfo(parcial.getAbsolutePath(), banderas());
                PackageInfo actual = instalada();
                if (nueva == null) throw new Fallo("El archivo descargado no es una APK válida.", "apk");
                if (!getContext().getPackageName().equals(nueva.packageName)) throw new Fallo("La APK no es de Flex & Fit.", "apk");
                if (codigo(nueva) <= codigo(actual)) throw new Fallo("Ya tienes esta versión o una más nueva.", "version");
                Set<String> fNueva = firmas(nueva), fActual = firmas(actual);
                if (fNueva.isEmpty() || !fNueva.equals(fActual)) {
                    throw new Fallo("La versión nueva está firmada con otra clave: Android no la instalaría encima. Desinstala la app y descárgala de GitHub.", "firma");
                }
                if (destino.exists() && !destino.delete()) throw new IOException("No puedo reemplazar la descarga anterior.");
                if (!parcial.renameTo(destino)) throw new IOException("No puedo guardar la descarga.");
                JSObject r = new JSObject();
                r.put("codigo", codigo(nueva));
                r.put("nombre", nueva.versionName);
                call.resolve(r);
            } catch (Fallo e) {
                borrar(parcial);
                call.reject(e.getMessage(), e.codigo);
            } catch (Exception e) {
                borrar(parcial);
                call.reject("No se pudo descargar: " + e.getMessage(), "red");
            }
        }, "flexfit-actualizar").start();
    }

    private static void borrar(File f) {
        if (f.exists() && !f.delete()) f.deleteOnExit();
    }

    // GitHub answers with a redirect to its file storage (https to https, which HttpURLConnection follows).
    private void bajar(String url, File destino) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "flex-and-fit-android");
        try {
            int estado = c.getResponseCode();
            if (estado != HttpURLConnection.HTTP_OK) throw new IOException("GitHub respondió " + estado);
            if (!"https".equals(c.getURL().getProtocol())) throw new IOException("la descarga no es segura");
            long total = c.getContentLengthLong();
            if (total > MAXIMO) throw new IOException("el archivo es demasiado grande");
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(destino)) {
                byte[] buf = new byte[64 * 1024];
                long bytes = 0, avisado = 0;
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    bytes += n;
                    if (bytes > MAXIMO) throw new IOException("el archivo es demasiado grande");
                    if (bytes - avisado >= 256 * 1024) {
                        avisado = bytes;
                        avisar(bytes, total);
                    }
                }
                avisar(bytes, total);
            }
        } finally {
            c.disconnect();
        }
    }

    private void avisar(long bytes, long total) {
        JSObject p = new JSObject();
        p.put("bytes", bytes);
        p.put("total", total);
        notifyListeners("progreso", p);
    }

    @PluginMethod
    public void instalar(PluginCall call) {
        File f = apk();
        if (!f.isFile()) {
            call.reject("Primero hay que descargar la versión nueva.", "sin-descarga");
            return;
        }
        JSObject r = new JSObject();
        try {
            if (!puedeInstalar()) {
                // "Instalar apps desconocidas" for this app; the web code calls instalar() again on resume.
                Intent ajustes = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                ajustes.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(ajustes);
                r.put("estado", "permiso");
                call.resolve(r);
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, MIME);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            r.put("estado", "abierto");
            call.resolve(r);
        } catch (RuntimeException e) {
            call.reject("No se pudo abrir el instalador: " + e.getMessage(), "instalador");
        }
    }

    private static final class Fallo extends Exception {
        private static final long serialVersionUID = 1L;
        final String codigo;

        Fallo(String mensaje, String codigo) {
            super(mensaje);
            this.codigo = codigo;
        }
    }
}
