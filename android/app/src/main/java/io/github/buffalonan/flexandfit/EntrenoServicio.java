package io.github.buffalonan.flexandfit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/** The foreground service behind EntrenoPlugin: an ongoing "Entreno en curso" notification that opens the app. */
public class EntrenoServicio extends Service {
    private static final String CANAL = "entreno";
    private static final int ID = 7300;
    // Keeps the CPU (not the screen) awake during the session, so the sound cues play on time with the phone locked.
    private PowerManager.WakeLock despierto;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(CANAL, "Entreno en curso", NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Mantiene la app abierta mientras entrenas");
            c.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(c);
        }
        String titulo = intent != null && intent.getStringExtra("titulo") != null ? intent.getStringExtra("titulo") : "Entreno";
        String cabecera = intent != null && intent.getStringExtra("cabecera") != null ? intent.getStringExtra("cabecera") : "Entreno en curso";
        long inicio = intent != null ? intent.getLongExtra("inicio", System.currentTimeMillis()) : System.currentTimeMillis();
        Intent abrir = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_stat_entreno)
                .setContentTitle(cabecera)
                .setContentText(titulo)
                .setWhen(inicio)
                .setUsesChronometer(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi)
                .build();
        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, ID, n, tipo);
        if (despierto == null) {
            despierto = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flexfit:entreno");
            despierto.setReferenceCounted(false);
        }
        despierto.acquire(4 * 60 * 60 * 1000L); // a session forgotten open lets go after 4 hours
        // If Android stops it anyway, don't bring it back by itself: the app starts it again with the session.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (despierto != null && despierto.isHeld()) despierto.release();
        Pitidos.cancelar();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
