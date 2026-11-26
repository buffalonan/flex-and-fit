package io.github.buffalonan.flexandfit;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the app alive during a session: while one is open (stretching player or gym logger) a foreground service
 * shows an ongoing notification, so Android (and Samsung's battery manager) is much less likely to close the app
 * when the phone is locked. The session is also saved on every change in the web code, in case it closes anyway.
 * It also plays the session's sound cues natively (Pitidos.java), so they sound with the phone locked.
 * JS: Capacitor.registerPlugin("Entreno").empezar({ titulo, inicio }), .pitidos({ lista, parciales }) and .terminar().
 */
@CapacitorPlugin(name = "Entreno")
public class EntrenoPlugin extends Plugin {
    @PluginMethod
    public void empezar(PluginCall call) {
        // Android 13+ shows the notification only with this permission; the service runs either way.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getActivity() != null
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7301);
        }
        pantalla(true);
        Intent i = new Intent(getContext(), EntrenoServicio.class);
        i.putExtra("titulo", call.getString("titulo", "Entreno"));
        // The notification's heading, in the app's language (the web side translates it).
        i.putExtra("cabecera", call.getString("cabecera", "Entreno en curso"));
        Double inicio = call.getDouble("inicio");
        i.putExtra("inicio", inicio == null ? System.currentTimeMillis() : inicio.longValue());
        try {
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (RuntimeException e) {
            // Not allowed right now (the app isn't in the foreground): the saved session still covers it.
            call.reject("No se pudo iniciar el servicio: " + e.getMessage());
        }
    }

    /**
     * Keeps the screen on while a session is open (the web's Wake Lock API isn't there in Android's WebView, and is
     * dropped whenever the page is hidden). The phone can still be locked with its button; the cues keep sounding.
     */
    private void pantalla(boolean on) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    /** Replaces the cues to play: lista = [{ en (ms, wall clock), notas: [[ms, Hz]], vib: [ms on, off, on…] }]. */
    @PluginMethod
    public void pitidos(PluginCall call) {
        Pitidos.programar(getContext().getApplicationContext(), call.getArray("lista"), call.getArray("parciales"));
        call.resolve();
    }

    @PluginMethod
    public void terminar(PluginCall call) {
        Pitidos.cancelar();
        pantalla(false);
        getContext().stopService(new Intent(getContext(), EntrenoServicio.class));
        call.resolve();
    }
}
