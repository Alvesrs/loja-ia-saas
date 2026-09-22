package com.saintsai.stock;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/login.html?next=cliente-estoque.html";

    private WebView webView;
    private ProgressBar loading;
    private LinearLayout errorView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(10,10,15));
        getWindow().setNavigationBarColor(Color.rgb(10,10,15));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10,10,15));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(10,10,15));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        loading = new ProgressBar(this);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.CENTER;
        root.addView(loading, lp);

        errorView = makeMessage("Falha ao carregar SaintsAI Estoque");
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        fetchAndRender();
    }

    private void fetchAndRender() {
        loading.setVisibility(View.VISIBLE);
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.INVISIBLE);

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL u = new URL(APP_URL);
                conn = (HttpURLConnection) u.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(20000);
                conn.setRequestProperty("Accept", "text/html,*/*");
                conn.setRequestProperty("User-Agent", "SaintsAIAndroid/1.0");

                int code = conn.getResponseCode();
                BufferedReader br = new BufferedReader(new InputStreamReader(
                        code >= 200 && code < 400 ? conn.getInputStream() : conn.getErrorStream(),
                        StandardCharsets.UTF_8));

                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line).append("\n");
                br.close();

                String html = sb.toString();
                runOnUiThread(() -> {
                    loading.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                    webView.loadDataWithBaseURL(APP_URL, html, "text/html", "UTF-8", null);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    loading.setVisibility(View.GONE);
                    webView.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                });
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private LinearLayout makeMessage(String msg) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(48,48,48,48);
        box.setBackgroundColor(Color.rgb(10,10,15));

        TextView t = new TextView(this);
        t.setText(msg);
        t.setTextColor(Color.WHITE);
        t.setTextSize(18);
        t.setGravity(Gravity.CENTER);
        box.addView(t);
        return box;
    }
}
