package com.saintsai.admin;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.view.Gravity;
import android.widget.LinearLayout;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/";

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
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(10,10,15));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                loading.setVisibility(View.VISIBLE);
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loading.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame() || !"GET".equalsIgnoreCase(request.getMethod())) {
                    return super.shouldInterceptRequest(view, request);
                }

                String url = request.getUrl().toString();
                if (!url.startsWith("https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/")) {
                    return super.shouldInterceptRequest(view, request);
                }

                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setRequestMethod("GET");
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(20000);
                    conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,*/*;q=0.8");
                    String ua = request.getRequestHeaders().get("User-Agent");
                    if (ua != null) conn.setRequestProperty("User-Agent", ua);

                    int code = conn.getResponseCode();
                    java.io.InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                    if (in == null) return super.shouldInterceptRequest(view, request);

                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = in.read(chunk)) != -1) buffer.write(chunk, 0, n);
                    in.close();

                    String contentType = conn.getHeaderField("Content-Type");
                    boolean isHtmlPage = url.endsWith("/painel/")
                            || url.contains("/painel/login.html")
                            || url.contains("/painel/dashboard.html")
                            || url.contains("/painel/cliente-estoque.html")
                            || url.contains("/painel/estoque.html")
                            || (contentType != null && contentType.toLowerCase().contains("text/html"));

                    if (isHtmlPage) {
                        return new WebResourceResponse(
                                "text/html",
                                "UTF-8",
                                new ByteArrayInputStream(buffer.toByteArray())
                        );
                    }
                } catch (Exception ignored) {
                }

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loading.setVisibility(View.GONE);
                    webView.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                }
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        loading = new ProgressBar(this);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.CENTER;
        root.addView(loading, lp);

        errorView = makeMessage("Falha ao carregar SaintsAI Admin");
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
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
