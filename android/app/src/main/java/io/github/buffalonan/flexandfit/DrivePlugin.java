package io.github.buffalonan.flexandfit;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/**
 * Signs in to the user's Google account for the Drive copy of the history (web/drive.js does the Drive calls).
 * It asks only for drive.appdata: the app's own hidden folder in the user's Drive, which no other app sees
 * and which can't read anything else of the Drive. Google finds this app's OAuth client by its package name and
 * the SHA-1 of the release key, so nothing secret is in the repo.
 * JS: Capacitor.registerPlugin("Drive")
 *   .disponible()                → { disponible }   (Google Play services on the phone)
 *   .token({ interactivo })      → { token }        (an access token, about an hour; with interactivo it shows Google's
 *                                                    account and consent screens if needed, else rejects with code "permiso")
 *   .olvidar({ token })          → {}               (drops a token Google no longer accepts, so the next one is fresh)
 */
@CapacitorPlugin(name = "Drive")
public class DrivePlugin extends Plugin {
    static final String ALCANCE = "https://www.googleapis.com/auth/drive.appdata";

    private ActivityResultLauncher<IntentSenderRequest> lanzador;
    private PluginCall esperando;

    @Override
    public void load() {
        // Plugins load in the activity's onCreate, early enough to register for a result.
        lanzador = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::trasElegir);
    }

    private AuthorizationRequest peticion() {
        return AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope(ALCANCE))).build();
    }

    @PluginMethod
    public void disponible(PluginCall call) {
        JSObject r = new JSObject();
        r.put("disponible", GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) == ConnectionResult.SUCCESS);
        call.resolve(r);
    }

    @PluginMethod
    public void token(PluginCall call) {
        boolean interactivo = Boolean.TRUE.equals(call.getBoolean("interactivo", false));
        Identity.getAuthorizationClient(getActivity()).authorize(peticion())
            .addOnSuccessListener(r -> {
                if (!r.hasResolution()) {
                    resolver(call, r);
                    return;
                }
                if (!interactivo || r.getPendingIntent() == null) {
                    call.reject("Hace falta iniciar sesión con Google.", "permiso");
                    return;
                }
                if (esperando != null) {
                    call.reject("Ya se está iniciando sesión.", "ocupado");
                    return;
                }
                esperando = call;
                lanzador.launch(new IntentSenderRequest.Builder(r.getPendingIntent().getIntentSender()).build());
            })
            .addOnFailureListener(e -> call.reject("No se pudo iniciar sesión con Google.", "error", e));
    }

    private void trasElegir(ActivityResult res) {
        PluginCall call = esperando;
        esperando = null;
        if (call == null) return;
        Intent datos = res.getData();
        if (datos == null) {
            call.reject("Inicio de sesión cancelado.", "cancelado");
            return;
        }
        try {
            resolver(call, Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(datos));
        } catch (Exception e) {
            call.reject("Inicio de sesión cancelado.", "cancelado", e);
        }
    }

    private void resolver(PluginCall call, AuthorizationResult r) {
        String token = r.getAccessToken();
        if (token == null || !r.getGrantedScopes().contains(ALCANCE)) {
            call.reject("Google no dio permiso para la carpeta de la app en Drive.", "permiso");
            return;
        }
        JSObject o = new JSObject();
        o.put("token", token);
        call.resolve(o);
    }

    @PluginMethod
    public void olvidar(PluginCall call) {
        String token = call.getString("token", "");
        // clearToken blocks: never on the main thread.
        new Thread(() -> {
            try {
                if (token != null && !token.isEmpty()) GoogleAuthUtil.clearToken(getContext(), token);
            } catch (Exception e) {
                // Already gone.
            }
            call.resolve();
        }).start();
    }
}
