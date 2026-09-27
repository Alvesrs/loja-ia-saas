package com.saintsai.sales;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    public static final String CHANNEL_SALES = "saintsai_sales";
    private static final String URL = "https://backend-prod-production-f338.up.railway.app/gerenciador-vendas/";
    private static final String APK_URL = "https://raw.githubusercontent.com/Alvesrs/loja-ia-saas/main/downloads/Gerenciador-de-Vendas.apk";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createSalesChannel();
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);

        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token ->
            getSharedPreferences("saintsai_push", MODE_PRIVATE).edit().putString("fcm_token", token).apply()
        );

        WebView web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        web.addJavascriptInterface(new PushBridge(), "AndroidPush");
        web.addJavascriptInterface(new UpdateBridge(), "AndroidUpdate");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient());
        web.loadUrl(URL);
    }

    public class PushBridge {
        @JavascriptInterface public String getToken() {
            return getSharedPreferences("saintsai_push", MODE_PRIVATE).getString("fcm_token", "");
        }
    }

    public class UpdateBridge {
        @JavascriptInterface public int getVersionCode() { return BuildConfig.VERSION_CODE; }
        @JavascriptInterface public String getVersionName() { return BuildConfig.VERSION_NAME; }

        @JavascriptInterface public void installLatest() {
            runOnUiThread(() -> {
                try {
                    DownloadManager dm=(DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE);
                    DownloadManager.Request req=new DownloadManager.Request(Uri.parse(APK_URL));
                    req.setTitle("Atualização do Gerenciador de Vendas");
                    req.setDescription("Baixando nova versão...");
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,"Gerenciador-de-Vendas.apk");
                    dm.enqueue(req);
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Atualização iniciada")
                        .setMessage("Quando o download terminar, toque na notificação para instalar a nova versão por cima da atual.")
                        .setPositiveButton("OK",null).show();
                } catch(Exception e) {
                    startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(APK_URL)));
                }
            });
        }
    }

    private void createSalesChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_SALES,
            "Novas vendas",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Avisos de novas vendas do SaintsAI");
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
    }
}
