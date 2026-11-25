package io.github.buffalonan.flexandfit;

import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.ChecksSdkIntAtLeast;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Reads the watch's workouts from Health Connect (COROS writes its sessions, heart rate and calories there).
 * Only reads, only on Android 14 or later, where Health Connect is part of the system.
 * JS: Capacitor.registerPlugin("Salud")
 *   .estado()                    → { disponible, permiso }
 *   .pedirPermiso()              → { disponible, permiso }
 *   .sesiones({ desde, hasta })  → { sesiones: [{ id, inicio, fin, tipo, categoria, titulo, origen, fcMedia, fcMax, kcal, curva, curvaPaso }] }
 *                                   (curva: average heart rate per curvaPaso seconds, 0 where there's none)
 *   .fc({ desde, hasta })        → { fcMedia, fcMax, ultima, ultimaEn, muestras }   (heart rate in a window, any source)
 * Times are epoch milliseconds.
 */
@CapacitorPlugin(
    name = "Salud",
    permissions = { @Permission(alias = "salud", strings = {
        SaludPlugin.EJERCICIO, SaludPlugin.FC, SaludPlugin.KCAL_TOTALES, SaludPlugin.KCAL_ACTIVAS
    }) }
)
public class SaludPlugin extends Plugin {
    static final String EJERCICIO = "android.permission.health.READ_EXERCISE";
    static final String FC = "android.permission.health.READ_HEART_RATE";
    static final String KCAL_TOTALES = "android.permission.health.READ_TOTAL_CALORIES_BURNED";
    static final String KCAL_ACTIVAS = "android.permission.health.READ_ACTIVE_CALORIES_BURNED";

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private static boolean disponible() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE;
    }

    private boolean concedido(String p) {
        return ContextCompat.checkSelfPermission(getContext(), p) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject estadoActual() {
        JSObject r = new JSObject();
        boolean d = disponible() && LectorSalud.hay(getContext());
        r.put("disponible", d);
        // The sessions are what matters; heart rate and calories are read when granted.
        r.put("permiso", d && concedido(EJERCICIO));
        r.put("fc", d && concedido(FC));
        r.put("kcal", d && (concedido(KCAL_TOTALES) || concedido(KCAL_ACTIVAS)));
        return r;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        call.resolve(estadoActual());
    }

    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        if (!disponible() || !LectorSalud.hay(getContext())) {
            call.resolve(estadoActual());
            return;
        }
        requestPermissionForAlias("salud", call, "trasPermiso");
    }

    @PermissionCallback
    private void trasPermiso(PluginCall call) {
        call.resolve(estadoActual());
    }

    @PluginMethod
    public void sesiones(PluginCall call) {
        if (!disponible() || !concedido(EJERCICIO)) {
            JSObject r = new JSObject();
            r.put("sesiones", new JSArray());
            call.resolve(r);
            return;
        }
        long hasta = (long) (double) call.getDouble("hasta", (double) System.currentTimeMillis());
        long desde = (long) (double) call.getDouble("desde", (double) (hasta - 30L * 86400000L));
        boolean fc = concedido(FC);
        boolean kt = concedido(KCAL_TOTALES), ka = concedido(KCAL_ACTIVAS);
        new Thread(() -> {
            if (!disponible()) return;
            try {
                JSObject r = new JSObject();
                r.put("sesiones", LectorSalud.sesiones(getContext(), desde, hasta, fc, kt, ka));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("No he podido leer Health Connect: " + e.getMessage());
            }
        }, "salud-sesiones").start();
    }

    @PluginMethod
    public void fc(PluginCall call) {
        if (!disponible() || !concedido(FC)) {
            call.resolve(new JSObject());
            return;
        }
        long hasta = (long) (double) call.getDouble("hasta", (double) System.currentTimeMillis());
        long desde = (long) (double) call.getDouble("desde", (double) (hasta - 5L * 60000L));
        new Thread(() -> {
            if (!disponible()) return;
            try {
                call.resolve(LectorSalud.fc(getContext(), desde, hasta));
            } catch (Exception e) {
                call.reject("No he podido leer Health Connect: " + e.getMessage());
            }
        }, "salud-fc").start();
    }
}
