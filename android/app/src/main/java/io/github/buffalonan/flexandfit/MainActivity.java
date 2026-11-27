package io.github.buffalonan.flexandfit;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts.
        registerPlugin(DescubrirPlugin.class);
        registerPlugin(SaludPlugin.class);
        registerPlugin(EntrenoPlugin.class);
        registerPlugin(ActualizarPlugin.class);
        registerPlugin(DrivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
