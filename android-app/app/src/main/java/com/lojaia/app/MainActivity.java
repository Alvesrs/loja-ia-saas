package com.lojaia.app;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://backend-prod-production-f338.up.railway.app/painel";
    private static final String APP_HOST = "backend-prod-production-f338.up.railway.app";

    private WebView webView;
    private View splashView;
    private Dialog popupDialog;
    private WebView popupWebView;

    private boolean hostInterno(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        return host != null && APP_HOST.equalsIgnoreCase(host);
    }

    private boolean hostMeta(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        return host.equals("facebook.com")
                || host.endsWith(".facebook.com")
                || host.equals("fb.com")
                || host.endsWith(".fb.com")
                || host.equals("facebook.net")
                || host.endsWith(".facebook.net");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configurarWebView(WebView view, boolean popupMeta) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(view, true);

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView current, WebResourceRequest request) {
                Uri uri = request.getUrl();

                // A janela criada pelo SDK da Meta precisa permanecer dentro
                // do app para preservar window.opener/postMessage/callback.
                if (hostInterno(uri) || (popupMeta && hostMeta(uri))) {
                    return false;
                }

                // Na WebView principal mantemos apenas o SaintsAI.
                // Links externos comuns continuam abrindo no navegador.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // Se não houver app externo compatível, não derruba a tela.
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView current, String url) {
                super.onPageFinished(current, url);

                if (!popupMeta) {
                    webView.setVisibility(View.VISIBLE);
                    if (splashView != null && splashView.getVisibility() == View.VISIBLE) {
                        splashView.animate()
                                .alpha(0f)
                                .setDuration(250)
                                .withEndAction(() -> splashView.setVisibility(View.GONE))
                                .start();
                    }
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebChromeClient criarChromeClientPrincipal() {
        return new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                fecharPopupMeta();

                popupDialog = new Dialog(MainActivity.this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                FrameLayout popupRoot = new FrameLayout(MainActivity.this);
                popupRoot.setBackgroundColor(Color.WHITE);

                popupWebView = new WebView(MainActivity.this);
                popupWebView.setBackgroundColor(Color.WHITE);
                configurarWebView(popupWebView, true);

                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        fecharPopupMeta();
                    }
                });

                popupRoot.addView(
                        popupWebView,
                        new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        )
                );

                ViewCompat.setOnApplyWindowInsetsListener(popupRoot, (v, insets) -> {
                    Insets bars = insets.getInsets(
                            WindowInsetsCompat.Type.statusBars()
                                    | WindowInsetsCompat.Type.navigationBars()
                                    | WindowInsetsCompat.Type.displayCutout()
                    );
                    v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                    return insets;
                });

                popupDialog.setContentView(popupRoot);
                popupDialog.setOnDismissListener(dialog -> {
                    if (popupWebView != null) {
                        popupWebView.stopLoading();
                        popupWebView.destroy();
                        popupWebView = null;
                    }
                    popupDialog = null;
                });
                popupDialog.show();
                ViewCompat.requestApplyInsets(popupRoot);

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }
        };
    }

    private void fecharPopupMeta() {
        if (popupDialog != null) {
            try {
                popupDialog.dismiss();
            } catch (Exception ignored) {
            }
        } else if (popupWebView != null) {
            popupWebView.destroy();
            popupWebView = null;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(5, 5, 7));
        getWindow().setNavigationBarColor(Color.rgb(5, 5, 7));
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 5, 7));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 5, 7));
        webView.setVisibility(View.INVISIBLE);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        splashView = new View(this);
        splashView.setBackgroundResource(R.drawable.splash_background);
        root.addView(splashView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.statusBars()
                            | WindowInsetsCompat.Type.navigationBars()
                            | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);

        configurarWebView(webView, false);
        webView.setWebChromeClient(criarChromeClientPrincipal());

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
            webView.setVisibility(View.VISIBLE);
            splashView.setVisibility(View.GONE);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (popupDialog != null) {
                    if (popupWebView != null && popupWebView.canGoBack()) {
                        popupWebView.goBack();
                    } else {
                        fecharPopupMeta();
                    }
                    return;
                }

                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        fecharPopupMeta();
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }
}
