package com.saintsai.admin;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/";
    private static final String APP_HOST = "ldpiryzsunxwuhyvvogg.supabase.co";
    private static final String PROXY_PREFIX = "/functions/v1/saintsai-proxy/";

    private WebView webView;
    private ProgressBar loading;
    private LinearLayout errorView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(10, 10, 15));
        getWindow().setNavigationBarColor(Color.rgb(10, 10, 15));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10, 10, 15));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(10, 10, 15));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUserAgentString(settings.getUserAgentString() + " SaintsAIApp/2.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
                if (!"https".equalsIgnoreCase(uri.getScheme())) return null;
                if (!APP_HOST.equalsIgnoreCase(uri.getHost())) return null;
                if (!uri.getPath().startsWith(PROXY_PREFIX)) return null;

                try {
                    return fetchForWebView(uri.toString(), request.getRequestHeaders());
                } catch (Exception ignored) {
                    return null;
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                loading.setVisibility(View.VISIBLE);
                errorView.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loading.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    loading.setVisibility(View.GONE);
                    webView.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                }
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        loading = new ProgressBar(this);
        FrameLayout.LayoutParams loadingParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        loadingParams.gravity = Gravity.CENTER;
        root.addView(loading, loadingParams);

        errorView = buildErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
        webView.loadUrl(APP_URL);
    }

    private WebResourceResponse fetchForWebView(String url, Map<String, String> requestHeaders) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestMethod("GET");

        for (Map.Entry<String, String> h : requestHeaders.entrySet()) {
            String key = h.getKey();
            if (key == null) continue;
            if ("host".equalsIgnoreCase(key) || "content-length".equalsIgnoreCase(key)) continue;
            conn.setRequestProperty(key, h.getValue());
        }

        conn.connect();

        int status = conn.getResponseCode();
        String reason = conn.getResponseMessage();
        if (reason == null || reason.trim().isEmpty()) reason = status >= 400 ? "Error" : "OK";

        InputStream raw = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (raw == null) raw = InputStream.nullInputStream();
        InputStream body = new BufferedInputStream(raw);

        String mime = guessMime(Uri.parse(url), conn.getContentType());
        String encoding = guessEncoding(conn.getContentType());

        Map<String, String> headers = new HashMap<>();
        for (Map.Entry<String, List<String>> e : conn.getHeaderFields().entrySet()) {
            String key = e.getKey();
            if (key == null || e.getValue() == null || e.getValue().isEmpty()) continue;

            if ("content-type".equalsIgnoreCase(key) ||
                "content-length".equalsIgnoreCase(key) ||
                "content-encoding".equalsIgnoreCase(key) ||
                "transfer-encoding".equalsIgnoreCase(key) ||
                "content-security-policy".equalsIgnoreCase(key) ||
                "x-content-type-options".equalsIgnoreCase(key)) {
                continue;
            }
            headers.put(key, e.getValue().get(0));
        }
        headers.put("Access-Control-Allow-Origin", "*");

        return new WebResourceResponse(mime, encoding, status, reason, headers, body);
    }

    private String guessMime(Uri uri, String original) {
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase();

        if (path.contains("/api/")) return "application/json";
        if (path.endsWith(".html") || path.endsWith(".htm") || path.endsWith("/painel/")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".gif")) return "image/gif";
        if (path.endsWith(".ico")) return "image/x-icon";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".ttf")) return "font/ttf";

        if (original != null && !original.toLowerCase().startsWith("text/plain")) {
            int semi = original.indexOf(';');
            return semi > 0 ? original.substring(0, semi).trim() : original.trim();
        }
        return "text/html";
    }

    private String guessEncoding(String contentType) {
        if (contentType != null) {
            String lower = contentType.toLowerCase();
            int i = lower.indexOf("charset=");
            if (i >= 0) {
                String value = contentType.substring(i + 8).trim();
                int semi = value.indexOf(';');
                if (semi >= 0) value = value.substring(0, semi);
                value = value.replace("\"", "").replace("'", "").trim();
                if (!value.isEmpty()) return value;
            }
        }
        return "UTF-8";
    }

    private LinearLayout buildErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(56, 56, 56, 56);
        box.setBackgroundColor(Color.rgb(10, 10, 15));

        TextView titleView = new TextView(this);
        titleView.setText("SaintsAI Admin");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(24);
        titleView.setGravity(Gravity.CENTER);
        titleView.setPadding(0, 0, 0, 16);
        box.addView(titleView);

        TextView msg = new TextView(this);
        msg.setText("Não foi possível carregar o aplicativo. Verifique sua conexão e tente novamente.");
        msg.setTextColor(Color.LTGRAY);
        msg.setTextSize(16);
        msg.setGravity(Gravity.CENTER);
        msg.setPadding(0, 0, 0, 24);
        box.addView(msg);

        Button retry = new Button(this);
        retry.setText("Tentar novamente");
        retry.setOnClickListener(v -> {
            errorView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.reload();
        });
        box.addView(retry, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        return box;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
