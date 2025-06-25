package com.safewalk;

import android.app.IntentService;
import android.content.Intent;
import android.location.Location;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.Tasks;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SOSWidgetService extends IntentService {
    public SOSWidgetService() {
        super("SOSWidgetService");
    }

    @Override
    protected void onHandleIntent(Intent intent) {
        FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(this);
        try {
            Location location = Tasks.await(client.getLastLocation());

            if (location != null) {
                JSONObject json = new JSONObject();
                json.put("name", "SafeUser");
                json.put("timestamp", System.currentTimeMillis());
                json.put("lat", location.getLatitude());
                json.put("lon", location.getLongitude());
                json.put("contact", "9999999999");
                json.put("status", "Active");

                URL url = new URL("http://192.168.x.x:5000/api/trigger-sos");  // 🔁 Replace with correct IP
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setDoOutput(true);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");

                OutputStream os = conn.getOutputStream();
                os.write(json.toString().getBytes("UTF-8"));
                os.close();

                int resCode = conn.getResponseCode();
                showToast(resCode == 200 ? "✅ SOS sent!" : "❌ SOS failed");
                conn.disconnect();
            } else {
                showToast("❌ Location not found");
            }
        } catch (Exception e) {
            e.printStackTrace();
            showToast("❌ Error occurred");
        }
    }

    private void showToast(String msg) {
        new Handler(Looper.getMainLooper()).post(() ->
            Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show());
    }
}
