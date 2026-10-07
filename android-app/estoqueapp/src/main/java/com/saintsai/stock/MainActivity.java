package com.saintsai.stock;

import android.app.Activity;
import android.Manifest;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.ClipData;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://backend-prod-production-f338.up.railway.app/cliente/";
    private static final String APP_HOST = "backend-prod-production-f338.up.railway.app";
    private static final int FILE_CHOOSER_REQUEST = 501;
    public static final String CHANNEL_CLIENT = "saintsai_client_updates";
    private static final String LATEST_APK_URL = "https://raw.githubusercontent.com/Alvesrs/loja-ia-saas/main/downloads/SaintsAI-Cliente.apk";

    private WebView webView;
    private SaintsSecurity security;
    private ProgressBar loading;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createClientChannel();
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7002);
        }
        refreshPushToken();

        getWindow().setStatusBarColor(Color.rgb(8, 7, 13));
        getWindow().setNavigationBarColor(Color.rgb(8, 7, 13));

        // Own the safe area once on Android 11+, including enforced edge-to-edge.
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 7, 13));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                int safeTypes = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
                int handledTypes = safeTypes | WindowInsets.Type.ime();
                android.graphics.Insets safe = insets.getInsets(handledTypes);
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);

                // The WebView is already inside these bounds. Forward zero values
                // so CSS env(safe-area-inset-*) and the visual viewport don't add
                // the bars/keyboard again. Keep dispatching updates when IME hides.
                return new WindowInsets.Builder(insets)
                        .setInsets(handledTypes, android.graphics.Insets.NONE)
                        .setInsetsIgnoringVisibility(safeTypes, android.graphics.Insets.NONE)
                        .setDisplayCutout(null)
                        .build();
            } else {
                // Older Android versions fit the activity and resize for IME.
                // Do not reserve the same system bars again inside that frame.
                v.setPadding(0, 0, 0, 0);
                WindowInsets remaining = insets.consumeSystemWindowInsets().consumeStableInsets();
                if (android.os.Build.VERSION.SDK_INT >= 28) {
                    remaining = remaining.consumeDisplayCutout();
                }
                return remaining;
            }
        });

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(8, 7, 13));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        webView.addJavascriptInterface(new ClientBridge(), "AndroidClient");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

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
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loading.setVisibility(View.GONE);
                    webView.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = filePathCallback;
                if (security != null) security.beginTrustedExternalFlow();
                try {
                    Intent intent = fileChooserParams.createIntent();
                    if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException e) {
                    if (security != null) security.endTrustedExternalFlow();
                    fileChooserCallback = null;
                    return false;
                }
            }

            @Override
            public boolean onCreateWindow(
                    WebView view,
                    boolean isDialog,
                    boolean isUserGesture,
                    Message resultMsg
            ) {
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView ignored, WebResourceRequest request) {
                        openExternal(request.getUrl());
                        return true;
                    }

                    @Override
                    public void onPageStarted(WebView ignored, String url, android.graphics.Bitmap favicon) {
                        openExternal(Uri.parse(url));
                        ignored.stopLoading();
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });

        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        loading = new ProgressBar(this);
        FrameLayout.LayoutParams loadingParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        loadingParams.gravity = Gravity.CENTER;
        root.addView(loading, loadingParams);

        errorView = makeMessage("Não foi possível carregar o SaintsAI Cliente. Verifique sua conexão e tente novamente.");
        errorView.setVisibility(View.GONE);
        errorView.setOnClickListener(v -> {
            errorView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            loading.setVisibility(View.VISIBLE);
            webView.loadUrl(APP_URL);
        });
        root.addView(
                errorView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        security=new SaintsSecurity(this,root,webView,"https://backend-prod-production-f338.up.railway.app/");
        webView.addJavascriptInterface(security,"AndroidSecurity");
        setContentView(root);
        root.requestApplyInsets();
        webView.loadUrl(APP_URL);
    }


    public class ClientBridge {
        @JavascriptInterface
        public String getPushToken() {
            return getSharedPreferences("saintsai_client_push", MODE_PRIVATE).getString("fcm_token", "");
        }

        @JavascriptInterface
        public boolean notificationsEnabled() {
            if (!androidx.core.app.NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) return false;
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                NotificationChannel channel = getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL_CLIENT);
                if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
            }
            return true;
        }

        @JavascriptInterface
        public void requestNotifications() {
            runOnUiThread(() -> {
                refreshPushToken();
                if (notificationsEnabled()) { notifyPushState(); return; }
                boolean asked = getSharedPreferences("saintsai_client_push", MODE_PRIVATE).getBoolean("permission_asked", false);
                if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
                    && (!asked || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))) {
                    getSharedPreferences("saintsai_client_push", MODE_PRIVATE).edit().putBoolean("permission_asked", true).apply();
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7002);
                } else {
                    Intent settings = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    settings.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(settings);
                }
            });
        }

        @JavascriptInterface
        public int getVersionCode() { return BuildConfig.VERSION_CODE; }

        @JavascriptInterface
        public String getVersionName() { return BuildConfig.VERSION_NAME; }

        @JavascriptInterface
        public void installLatest() {
            runOnUiThread(() -> {
                try {
                    DownloadManager dm=(DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE);
                    DownloadManager.Request req=new DownloadManager.Request(Uri.parse(LATEST_APK_URL));
                    req.setTitle("Atualização SaintsAI Cliente");
                    req.setDescription("Baixando nova versão...");
                    req.setMimeType("application/vnd.android.package-archive");
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,"SaintsAI-Cliente.apk");
                    dm.enqueue(req);
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Atualização iniciada")
                        .setMessage("Quando o download terminar, abra a notificação para instalar a nova versão por cima da atual.")
                        .setPositiveButton("OK",null)
                        .show();
                } catch(Exception e) {
                    openExternal(Uri.parse(LATEST_APK_URL));
                }
            });
        }
    }

    private void createClientChannel() {
        if (android.os.Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_CLIENT,
                "SaintsAI · Novidades",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Novos agendamentos, pagamentos e avisos do SaintsAI");
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return false;

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();

        if ("tel".equals(scheme) || "mailto".equals(scheme) || "whatsapp".equals(scheme)) {
            openExternal(uri);
            return true;
        }

        if (("https".equals(scheme) || "http".equals(scheme))
                && ("wa.me".equals(host) || host.endsWith(".whatsapp.com"))) {
            openExternal(uri);
            return true;
        }

        if(!("https".equals(scheme)&&APP_HOST.equals(host))){openExternal(uri);return true;}
        return false;
    }

    private void openExternal(Uri uri) {
        if (uri == null) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            // Mantém o WebView aberto caso nenhum app externo consiga tratar o link.
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if(security!=null&&security.result(requestCode,resultCode))return;
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (security != null) security.endTrustedExternalFlow();
            if (fileChooserCallback != null) {
                Uri[] results = collectSelectedUris(resultCode, data);
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    static Uri[] collectSelectedUris(int resultCode, Intent data) {
        if (resultCode != Activity.RESULT_OK || data == null) return null;
        LinkedHashSet<Uri> selected = new LinkedHashSet<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri uri = clip.getItemAt(i).getUri();
                if (uri != null) selected.add(uri);
            }
        }
        Uri single = data.getData();
        if (single != null) selected.add(single);
        if (selected.isEmpty()) {
            Uri[] parsed = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            if (parsed != null) for (Uri uri : parsed) if (uri != null) selected.add(uri);
        }
        return selected.isEmpty() ? null : selected.toArray(new Uri[0]);
    }

    private void refreshPushToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            getSharedPreferences("saintsai_client_push", MODE_PRIVATE).edit().putString("fcm_token", token).apply();
            notifyPushState();
        }).addOnFailureListener(error -> notifyPushState());
    }

    private void notifyPushState() {
        runOnUiThread(() -> {
            if (webView == null) return;
            String current = webView.getUrl();
            if (current == null || !APP_HOST.equals(Uri.parse(current).getHost())) return;
            webView.evaluateJavascript("window.dispatchEvent(new Event('saintsai-push-updated'))", null);
        });
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 7002) { refreshPushToken(); notifyPushState(); }
    }

    @Override protected void onResume(){super.onResume();if(security!=null)security.resume();notifyPushState();}

    @Override protected void onPause(){if(security!=null)security.pause();super.onPause();}

    @Override
    public void onBackPressed() {
        if(security!=null&&security.isLocked()){finish();return;}
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if(security!=null)security.destroy();
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    private LinearLayout makeMessage(String message) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(48, 48, 48, 48);
        box.setBackgroundColor(Color.rgb(8, 7, 13));

        TextView text = new TextView(this);
        text.setText(message + "\n\nToque para tentar novamente.");
        text.setTextColor(Color.WHITE);
        text.setTextSize(17);
        text.setGravity(Gravity.CENTER);
        box.addView(text);

        return box;
    }
}
