package io.github.buffalonan.flexandfit;

import android.content.Context;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ActiveCaloriesBurnedRecord;
import android.health.connect.datatypes.DataOrigin;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.ExerciseSessionType;
import android.health.connect.datatypes.HeartRateRecord;
import android.health.connect.datatypes.Record;
import android.health.connect.datatypes.TotalCaloriesBurnedRecord;
import android.health.connect.datatypes.WeightRecord;
import android.os.Build;
import android.os.OutcomeReceiver;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Health Connect reads for SaludPlugin, with the platform API of Android 14 (no extra libraries). */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
final class LectorSalud {
    private static final Executor EXEC = Executors.newCachedThreadPool();

    private LectorSalud() {}

    static boolean hay(Context ctx) {
        return ctx.getSystemService(HealthConnectManager.class) != null;
    }

    /** "fuerza", "flex" or "otro" for the gym and stretching kinds of workout, null for the rest (runs, walks, rides). */
    static String categoria(int tipo) {
        switch (tipo) {
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_STRENGTH_TRAINING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_WEIGHTLIFTING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_CALISTHENICS:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_BOOT_CAMP:
                return "fuerza";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_STRETCHING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_YOGA:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_PILATES:
                return "flex";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_OTHER_WORKOUT:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_EXERCISE_CLASS:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_GYMNASTICS:
                return "otro";
            default:
                return null;
        }
    }

    static JSArray sesiones(Context ctx, long desde, long hasta, boolean fc, boolean kcalTotales, boolean kcalActivas) throws Exception {
        HealthConnectManager hc = ctx.getSystemService(HealthConnectManager.class);
        JSArray out = new JSArray();
        for (ExerciseSessionRecord s : leer(hc, ExerciseSessionRecord.class, Instant.ofEpochMilli(desde), Instant.ofEpochMilli(hasta), null)) {
            String cat = categoria(s.getExerciseType());
            if (cat == null) continue;
            Instant a = s.getStartTime(), b = s.getEndTime();
            String origen = s.getMetadata().getDataOrigin().getPackageName();
            JSObject o = new JSObject();
            o.put("id", s.getMetadata().getId());
            o.put("inicio", a.toEpochMilli());
            o.put("fin", b.toEpochMilli());
            o.put("tipo", s.getExerciseType());
            o.put("categoria", cat);
            if (s.getTitle() != null) o.put("titulo", s.getTitle().toString());
            o.put("origen", origen);
            if (fc) {
                // The watch's own heart rate first; if it wrote none, any source's (another watch, a chest strap).
                List<HeartRateRecord> rs = leer(hc, HeartRateRecord.class, a, b, origen);
                long[] f = pulso(rs, a, b);
                if (f[2] == 0) { rs = leer(hc, HeartRateRecord.class, a, b, null); f = pulso(rs, a, b); }
                if (f[2] > 0) {
                    o.put("fcMedia", f[0]);
                    o.put("fcMax", f[1]);
                    long paso = curvaPaso(a, b);
                    o.put("curva", curva(rs, a, b, paso));
                    o.put("curvaPaso", paso / 1000);
                }
            }
            // Calories from the same app only: Health Connect can't add up other sources without double counting.
            double kcal = -1;
            if (kcalTotales) kcal = energia(leer(hc, TotalCaloriesBurnedRecord.class, a, b, origen), a, b);
            if (kcal <= 0 && kcalActivas) kcal = energia(leer(hc, ActiveCaloriesBurnedRecord.class, a, b, origen), a, b);
            if (kcal > 0) o.put("kcal", Math.round(kcal));
            out.put(o);
        }
        return out;
    }

    /** Body weight readings in a window, any source, as { t (ms), kg, origen }. */
    static JSArray pesos(Context ctx, long desde, long hasta) throws Exception {
        HealthConnectManager hc = ctx.getSystemService(HealthConnectManager.class);
        JSArray out = new JSArray();
        for (WeightRecord w : leer(hc, WeightRecord.class, Instant.ofEpochMilli(desde), Instant.ofEpochMilli(hasta), null)) {
            JSObject o = new JSObject();
            o.put("t", w.getTime().toEpochMilli());
            o.put("kg", w.getWeight().getInGrams() / 1000.0);
            o.put("origen", w.getMetadata().getDataOrigin().getPackageName());
            out.put(o);
        }
        return out;
    }

    static JSObject fc(Context ctx, long desde, long hasta) throws Exception {
        HealthConnectManager hc = ctx.getSystemService(HealthConnectManager.class);
        Instant a = Instant.ofEpochMilli(desde), b = Instant.ofEpochMilli(hasta);
        JSObject o = new JSObject();
        long ultima = 0, ultimaEn = 0, suma = 0, max = 0, n = 0;
        for (HeartRateRecord r : leer(hc, HeartRateRecord.class, a, b, null)) {
            for (HeartRateRecord.HeartRateSample m : r.getSamples()) {
                Instant t = m.getTime();
                if (t.isBefore(a) || t.isAfter(b)) continue;
                long bpm = m.getBeatsPerMinute();
                suma += bpm;
                max = Math.max(max, bpm);
                n++;
                if (t.toEpochMilli() >= ultimaEn) { ultimaEn = t.toEpochMilli(); ultima = bpm; }
            }
        }
        o.put("muestras", n);
        if (n > 0) {
            o.put("fcMedia", Math.round((double) suma / n));
            o.put("fcMax", max);
            o.put("ultima", ultima);
            o.put("ultimaEn", ultimaEn);
        }
        return o;
    }

    /** The heart-rate curve's bucket in ms: a minute, or longer so a long workout keeps at most 180 points. */
    static long curvaPaso(Instant a, Instant b) {
        long dur = b.toEpochMilli() - a.toEpochMilli();
        return Math.max(60000L, ((dur / 180) / 1000 + 1) * 1000);
    }

    /** The average heart rate of each bucket of [a, b] (0 where the watch wrote nothing), for the session's chart. */
    private static JSArray curva(List<HeartRateRecord> rs, Instant a, Instant b, long paso) {
        long ini = a.toEpochMilli();
        int n = (int) Math.max(1, (b.toEpochMilli() - ini + paso - 1) / paso);
        long[] suma = new long[n], cuenta = new long[n];
        for (HeartRateRecord r : rs) {
            for (HeartRateRecord.HeartRateSample m : r.getSamples()) {
                if (m.getTime().isBefore(a) || m.getTime().isAfter(b)) continue;
                int i = (int) Math.min(n - 1, (m.getTime().toEpochMilli() - ini) / paso);
                suma[i] += m.getBeatsPerMinute();
                cuenta[i]++;
            }
        }
        JSArray out = new JSArray();
        for (int i = 0; i < n; i++) out.put(cuenta[i] > 0 ? Math.round((double) suma[i] / cuenta[i]) : 0);
        return out;
    }

    /** { average, max, samples } of the samples inside [a, b]. */
    private static long[] pulso(List<HeartRateRecord> rs, Instant a, Instant b) {
        long suma = 0, max = 0, n = 0;
        for (HeartRateRecord r : rs) {
            for (HeartRateRecord.HeartRateSample m : r.getSamples()) {
                if (m.getTime().isBefore(a) || m.getTime().isAfter(b)) continue;
                suma += m.getBeatsPerMinute();
                max = Math.max(max, m.getBeatsPerMinute());
                n++;
            }
        }
        return new long[] { n > 0 ? Math.round((double) suma / n) : 0, max, n };
    }

    /** Kilocalories inside [a, b]; a record that sticks out counts in proportion to the part inside. */
    private static double energia(List<? extends Record> rs, Instant a, Instant b) {
        double total = 0;
        for (Record r : rs) {
            Instant ini, fin;
            double cal;
            if (r instanceof TotalCaloriesBurnedRecord) {
                TotalCaloriesBurnedRecord t = (TotalCaloriesBurnedRecord) r;
                ini = t.getStartTime(); fin = t.getEndTime(); cal = t.getEnergy().getInCalories();
            } else if (r instanceof ActiveCaloriesBurnedRecord) {
                ActiveCaloriesBurnedRecord t = (ActiveCaloriesBurnedRecord) r;
                ini = t.getStartTime(); fin = t.getEndTime(); cal = t.getEnergy().getInCalories();
            } else continue;
            long dur = fin.toEpochMilli() - ini.toEpochMilli();
            long dentro = Math.min(fin.toEpochMilli(), b.toEpochMilli()) - Math.max(ini.toEpochMilli(), a.toEpochMilli());
            if (dentro <= 0) continue;
            total += dur > 0 ? cal * dentro / dur : cal;
        }
        // Health Connect's Energy is in small calories.
        return total / 1000.0;
    }

    /** Every record of a type overlapping [a, b], optionally from one app only. Blocks: call it off the main thread. */
    private static <T extends Record> List<T> leer(HealthConnectManager hc, Class<T> clase, Instant a, Instant b, String origen) throws Exception {
        List<T> out = new ArrayList<>();
        long token = -1;
        do {
            ReadRecordsRequestUsingFilters.Builder<T> rb = new ReadRecordsRequestUsingFilters.Builder<>(clase)
                .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(a).setEndTime(b).build())
                .setPageSize(1000);
            if (origen != null) rb.addDataOrigins(new DataOrigin.Builder().setPackageName(origen).build());
            if (token != -1) rb.setPageToken(token);
            CompletableFuture<ReadRecordsResponse<T>> f = new CompletableFuture<>();
            hc.readRecords(rb.build(), EXEC, new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
                @Override public void onResult(ReadRecordsResponse<T> r) { f.complete(r); }
                @Override public void onError(HealthConnectException e) { f.completeExceptionally(e); }
            });
            ReadRecordsResponse<T> r = f.get(30, TimeUnit.SECONDS);
            out.addAll(r.getRecords());
            token = r.getNextPageToken();
        } while (token != -1 && out.size() < 20000);
        return out;
    }
}
