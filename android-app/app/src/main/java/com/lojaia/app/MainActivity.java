package com.lojaia.app;

import android.annotation.SuppressLint;
import android.content.Intent;
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
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://mobile-proxy-production.up.railway.app/painel/";
    private static final String APP_HOST = "mobile-proxy-production.up.railway.app";

    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorBox;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(5, 5, 7));
        getWindow().setNavigationBarColor(Color.rgb(5, 5, 7));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 5, 7));

        try {
            webView = new WebView(this);
            webView.setBackgroundColor(Color.rgb(5, 5, 7));

            WebSettings s = webView.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setDatabaseEnabled(true);
            s.setLoadsImagesAutomatically(true);
            s.setUseWideViewPort(true);
            s.setLoadWithOverviewMode(false);
            s.setCacheMode(WebSettings.LOAD_DEFAULT);

            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            cm.setAcceptThirdPartyCookies(webView, true);

            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if ("https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())) {
                        return false;
                    }
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {}
                    return true;
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    progress.setVisibility(View.GONE);
                    errorBox.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    super.onReceivedError(view, request, error);
                    if (request.isForMainFrame()) {
                        progress.setVisibility(View.GONE);
                        webView.setVisibility(View.GONE);
                        errorBox.setVisibility(View.VISIBLE);
                    }
                }
            });

            root.addView(webView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));

            progress = new ProgressBar(this);
            FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            pp.gravity = Gravity.CENTER;
            root.addView(progress, pp);

            errorBox = criarErro();
            errorBox.setVisibility(View.GONE);
            root.addView(errorBox, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));

            setContentView(root);
            webView.loadUrl(APP_URL);
        } catch (Throwable t) {
            setContentView(criarFalhaWebView(t));
        }
    }

    private LinearLayout criarErro() {
        LinearLayout box = baseMensagem();
        TextView txt = texto("Não foi possível carregar o SaintsAI dentro do aplicativo.");
        box.addView(txt);

        Button tentar = botao("Tentar novamente");
        tentar.setOnClickListener(v -> {
            errorBox.setVisibility(View.GONE);
            progress.setVisibility(View.VISIBLE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(APP_URL);
        });
        box.addView(tentar);

        Button navegador = botao("Abrir no navegador");
        navegador.setOnClickListener(v -> abrirNavegador());
        box.addView(navegador);
        return box;
    }

    private View criarFalhaWebView(Throwable t) {
        LinearLayout box = baseMensagem();
        box.addView(texto("O componente Android WebView não conseguiu iniciar. Atualize o Android System WebView/Chrome e tente novamente."));
        Button navegador = botao("Abrir SaintsAI no navegador");
        navegador.setOnClickListener(v -> abrirNavegador());
        box.addView(navegador);
        return box;
    }

    private LinearLayout baseMensagem() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(48, 48, 48, 48);
        box.setBackgroundColor(Color.rgb(5, 5, 7));
        return box;
    }

    private TextView texto(String msg) {
        TextView t = new TextView(this);
        t.setText(msg);
        t.setTextColor(Color.WHITE);
        t.setTextSize(17);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, 0, 0, 24);
        return t;
    }

    private Button botao(String label) {
        Button b = new Button(this);
        b.setText(label);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(0, 10, 0, 10);
        b.setLayoutParams(lp);
        return b;
    }

    private void abrirNavegador() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL)));
        } catch (Exception ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
