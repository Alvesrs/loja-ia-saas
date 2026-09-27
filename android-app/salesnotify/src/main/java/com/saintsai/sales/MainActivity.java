package com.saintsai.sales;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;\nimport android.webkit.JavascriptInterface;\nimport com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    public static final String CHANNEL_SALES = "saintsai_sales";
    private static final String URL = "https://backend-prod-production-f338.up.railway.app/gerenciador-vendas/";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createSalesChannel();
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);

        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> getSharedPreferences(\"saintsai_push\", MODE_PRIVATE).edit().putString(\"fcm_token\", token).apply());\n\n        WebView web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        web.addJavascriptInterface(new PushBridge(), \"AndroidPush\");\n        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient());
        web.loadUrl(URL);
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
