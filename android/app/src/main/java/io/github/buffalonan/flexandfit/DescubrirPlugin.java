package io.github.buffalonan.flexandfit;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Finds the Mac on the Wi-Fi: the Mac announces Flex & Fit over Bonjour as _flexandfit._tcp
 * (scripts/mac/install.sh), and this looks for it with Android's NsdManager for a few seconds.
 * JS: Capacitor.registerPlugin("Descubrir").buscar({ ms }) resolves to { direcciones: ["http://<ip>:<port>"] }.
 */
@CapacitorPlugin(name = "Descubrir")
public class DescubrirPlugin extends Plugin {
    private static final String TIPO = "_flexandfit._tcp.";

    @PluginMethod
    public void buscar(PluginCall call) {
        int ms = Math.max(1000, Math.min(15000, call.getInt("ms", 4000)));
        NsdManager nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        if (nsd == null) {
            responder(call, Collections.emptySet());
            return;
        }
        Handler main = new Handler(Looper.getMainLooper());
        Set<String> encontradas = Collections.synchronizedSet(new LinkedHashSet<>());
        // Older Android versions resolve one service at a time, so found services wait in a queue.
        ArrayDeque<NsdServiceInfo> cola = new ArrayDeque<>();
        boolean[] resolviendo = { false };
        boolean[] terminado = { false };

        Runnable[] siguiente = new Runnable[1];
        siguiente[0] = () -> {
            NsdServiceInfo info;
            synchronized (cola) {
                if (resolviendo[0] || terminado[0] || cola.isEmpty()) return;
                info = cola.poll();
                resolviendo[0] = true;
            }
            resolver(nsd, info, new NsdManager.ResolveListener() {
                @Override
                public void onResolveFailed(NsdServiceInfo s, int error) {
                    synchronized (cola) { resolviendo[0] = false; }
                    main.post(siguiente[0]);
                }

                @Override
                public void onServiceResolved(NsdServiceInfo s) {
                    for (InetAddress a : direcciones(s)) {
                        if (a instanceof Inet4Address) encontradas.add("http://" + a.getHostAddress() + ":" + s.getPort());
                    }
                    synchronized (cola) { resolviendo[0] = false; }
                    main.post(siguiente[0]);
                }
            });
        };

        NsdManager.DiscoveryListener escucha = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String tipo) {}
            @Override public void onDiscoveryStopped(String tipo) {}
            @Override public void onServiceLost(NsdServiceInfo s) {}
            @Override public void onStartDiscoveryFailed(String tipo, int error) {}
            @Override public void onStopDiscoveryFailed(String tipo, int error) {}

            @Override
            public void onServiceFound(NsdServiceInfo s) {
                synchronized (cola) { cola.add(s); }
                main.post(siguiente[0]);
            }
        };

        try {
            nsd.discoverServices(TIPO, NsdManager.PROTOCOL_DNS_SD, escucha);
        } catch (RuntimeException e) {
            responder(call, Collections.emptySet());
            return;
        }
        main.postDelayed(() -> {
            synchronized (cola) { terminado[0] = true; }
            try {
                nsd.stopServiceDiscovery(escucha);
            } catch (RuntimeException e) {
                // Discovery never started (no Wi-Fi): nothing to stop.
            }
            responder(call, encontradas);
        }, ms);
    }

    @SuppressWarnings("deprecation") // resolveService is the only way before Android 14.
    private static void resolver(NsdManager nsd, NsdServiceInfo info, NsdManager.ResolveListener l) {
        nsd.resolveService(info, l);
    }

    @SuppressWarnings("deprecation") // getHost is the only way before Android 14.
    private static List<InetAddress> direcciones(NsdServiceInfo s) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return s.getHostAddresses();
        List<InetAddress> l = new ArrayList<>();
        if (s.getHost() != null) l.add(s.getHost());
        return l;
    }

    private static void responder(PluginCall call, Set<String> encontradas) {
        JSArray lista = new JSArray();
        synchronized (encontradas) {
            for (String d : encontradas) lista.put(d);
        }
        JSObject r = new JSObject();
        r.put("direcciones", lista);
        call.resolve(r);
    }
}
