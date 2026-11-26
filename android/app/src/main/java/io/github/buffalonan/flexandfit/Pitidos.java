package io.github.buffalonan.flexandfit;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Plays the session's sound cues (web/avisos.js) at their times, natively, so they sound with the phone locked while
 * the web view is frozen. Each cue is a few harp-like notes, synthesised here from the same notes and partials the
 * web side uses, plus a vibration. A new list replaces the old one; the foreground service keeps the process (and,
 * with its wake lock, the clock) running.
 */
final class Pitidos {
    private static final Object TOKEN = new Object();
    private static final int HZ = 44100;
    private static Handler handler;

    private Pitidos() {}

    private static synchronized Handler handler() {
        if (handler == null) {
            HandlerThread h = new HandlerThread("pitidos");
            h.start();
            handler = new Handler(h.getLooper());
        }
        return handler;
    }

    static synchronized void programar(Context ctx, JSONArray lista, JSONArray parciales) {
        Handler h = handler();
        h.removeCallbacksAndMessages(TOKEN);
        if (lista == null) return;
        long ahora = System.currentTimeMillis(), up = SystemClock.uptimeMillis();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject a = lista.optJSONObject(i);
            if (a == null) continue;
            long espera = (long) a.optDouble("en", 0) - ahora;
            if (espera < -1500) continue;
            JSONArray notas = a.optJSONArray("notas"), vib = a.optJSONArray("vib");
            h.postAtTime(() -> tocar(ctx, notas, vib, parciales), TOKEN, up + Math.max(0, espera));
        }
    }

    static synchronized void cancelar() {
        if (handler != null) handler.removeCallbacksAndMessages(TOKEN);
    }

    private static void tocar(Context ctx, JSONArray notas, JSONArray vib, JSONArray parciales) {
        vibrar(ctx, vib);
        if (notas == null || notas.length() == 0 || parciales == null) return;
        AudioTrack pista = null;
        try {
            double ultima = 0;
            for (int i = 0; i < notas.length(); i++) ultima = Math.max(ultima, notas.getJSONArray(i).getDouble(0));
            int n = (int) ((ultima / 1000 + 1.6) * HZ);
            float[] mezcla = new float[n];
            for (int i = 0; i < notas.length(); i++) {
                JSONArray nota = notas.getJSONArray(i);
                int desde = (int) (nota.getDouble(0) / 1000 * HZ);
                double f = nota.getDouble(1);
                for (int k = 0; k < parciales.length(); k++) {
                    JSONArray p = parciales.getJSONArray(k);
                    double w = 2 * Math.PI * f * p.getDouble(0) / HZ, nivel = p.getDouble(1), caida = p.getDouble(2);
                    for (int s = desde; s < n; s++) {
                        double t = (double) (s - desde) / HZ;
                        double env = Math.min(1, t / 0.006) * Math.exp(-caida * t);
                        mezcla[s] += (float) (nivel * env * Math.sin(w * (s - desde)));
                    }
                }
            }
            short[] pcm = new short[n];
            for (int s = 0; s < n; s++) {
                // The last 50 ms fade to silence, so the end doesn't click.
                double cola = Math.min(1, (double) (n - s) / (HZ * 0.05));
                pcm[s] = (short) Math.max(-32767, Math.min(32767, mezcla[s] * cola * 0.22 * 32767));
            }
            pista = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build())
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(HZ)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build())
                    .setBufferSizeInBytes(n * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build();
            pista.write(pcm, 0, n);
            pista.play();
            AudioTrack sonando = pista;
            pista = null;
            handler().postDelayed(sonando::release, (long) n * 1000 / HZ + 300);
        } catch (Exception e) {
            // No sound this time; the vibration has gone already.
        } finally {
            if (pista != null) pista.release(); // it failed after being made
        }
    }

    private static void vibrar(Context ctx, JSONArray vib) {
        if (vib == null || vib.length() == 0) return;
        Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        long[] patron = new long[vib.length() + 1];
        for (int i = 0; i < vib.length(); i++) patron[i + 1] = vib.optLong(i, 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(patron, -1));
        else v.vibrate(patron, -1);
    }
}
