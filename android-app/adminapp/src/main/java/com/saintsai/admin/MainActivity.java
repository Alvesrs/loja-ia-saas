package com.saintsai.admin;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.os.Message;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/login.html?next=admin-mobile.html&ui=16";
    private static final String PROXY_PREFIX = "https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/";

    public class AgentBridge {
        @JavascriptInterface public int getVersionCode(){return BuildConfig.VERSION_CODE;}
        @JavascriptInterface public String getVersionName(){return BuildConfig.VERSION_NAME;}
        @JavascriptInterface public void installLatest(){runOnUiThread(() -> {
            try{
                android.app.DownloadManager dm=(android.app.DownloadManager)getSystemService(DOWNLOAD_SERVICE);
                android.app.DownloadManager.Request req=new android.app.DownloadManager.Request(Uri.parse("https://raw.githubusercontent.com/Alvesrs/loja-ia-saas/main/downloads/Agente-SaintsAI.apk"));
                req.setTitle("Atualização Agente SaintsAI");req.setMimeType("application/vnd.android.package-archive");
                req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS,"Agente-SaintsAI-"+System.currentTimeMillis()+".apk");
                dm.enqueue(req);
                new android.app.AlertDialog.Builder(MainActivity.this).setTitle("Atualização iniciada").setMessage("Quando o download terminar, toque na notificação para instalar a nova versão. Sua conta será mantida.").setPositiveButton("OK",null).show();
            }catch(Exception e){Toast.makeText(MainActivity.this,"Não foi possível baixar a atualização. Confira a conexão e tente novamente.",Toast.LENGTH_LONG).show();}
        });}
    }
    private WebView webView;
    private SaintsSecurity security;
    private ProgressBar loading;
    private LinearLayout errorView;
    private boolean loadingHtmlManually = false;

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
        s.setSupportMultipleWindows(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AgentBridge(){
            @JavascriptInterface public void openWhatsApp(String phone){
                if(phone == null || !phone.matches("55[0-9]{10,11}")) return;
                runOnUiThread(() -> openExternal(Uri.parse("https://wa.me/" + phone)));
            }
        },"AndroidAgent");
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message result){
                if(!gesture) return false;
                WebView child=new WebView(MainActivity.this);
                child.setWebViewClient(new WebViewClient(){
                    @Override public boolean shouldOverrideUrlLoading(WebView v, String url){openExternal(Uri.parse(url));v.destroy();return true;}
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){return shouldOverrideUrlLoading(v,r.getUrl().toString());}
                });
                ((WebView.WebViewTransport)result.obj).setWebView(child);result.sendToTarget();return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url){
                if(url.startsWith(PROXY_PREFIX)){loadHtmlPage(url);return true;}
                return openExternal(Uri.parse(url));
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri targetUri=request.getUrl();
                String targetScheme=targetUri.getScheme(), targetHost=targetUri.getHost();
                if ("whatsapp".equalsIgnoreCase(targetScheme)||"intent".equalsIgnoreCase(targetScheme)
                        ||"wa.me".equalsIgnoreCase(targetHost)||"api.whatsapp.com".equalsIgnoreCase(targetHost)
                        ||"web.whatsapp.com".equalsIgnoreCase(targetHost)) {
                    openExternal(targetUri);
                    return true;
                }
                if (request.isForMainFrame()
                        && "GET".equalsIgnoreCase(request.getMethod())
                        && request.getUrl().toString().startsWith(PROXY_PREFIX)) {
                    String target = request.getUrl().toString();
                    if (target.contains("/configuracoes.html")) {
                        target = PROXY_PREFIX + "admin-mobile.html?v=6#config";
                    } else if (target.contains("/admin.html")
                            || target.contains("/dashboard.html")
                            || target.contains("/pedidos.html")
                            || target.contains("/produtos.html")
                            || target.contains("/clientes.html")) {
                        target = PROXY_PREFIX + "admin-mobile.html?v=6#home";
                    }
                    loadHtmlPage(target);
                    return true;
                }
                if(request.isForMainFrame()&&!request.getUrl().toString().startsWith(PROXY_PREFIX)){
                    openExternal(request.getUrl());
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if(recoverExternalWhatsApp(view, Uri.parse(url))) return;
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
                if(recoverExternalWhatsApp(view,request.getUrl())) return;
                if (request.isForMainFrame() && !loadingHtmlManually) {
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

        security=new SaintsSecurity(this,root,webView,PROXY_PREFIX);
        webView.addJavascriptInterface(security,"AndroidSecurity");
        setContentView(root);
        loadHtmlPage(APP_URL);
    }

    // Defensive recovery for direct loads and redirects that skip URL interception.
    private boolean recoverExternalWhatsApp(WebView view,Uri uri){
        String scheme=uri.getScheme(),host=uri.getHost();
        boolean external="whatsapp".equalsIgnoreCase(scheme)||"wa.me".equalsIgnoreCase(host)||"api.whatsapp.com".equalsIgnoreCase(host)||"web.whatsapp.com".equalsIgnoreCase(host)
            ||("intent".equalsIgnoreCase(scheme)&&uri.toString().contains("scheme=whatsapp"));
        if(!external)return false;
        view.stopLoading();
        loading.setVisibility(View.GONE);errorView.setVisibility(View.GONE);view.setVisibility(View.VISIBLE);
        openExternal(uri);
        if(view.canGoBack())view.goBack();
        return true;
    }
    private boolean openExternal(Uri uri){
        String scheme=uri.getScheme();
        if("intent".equalsIgnoreCase(scheme)){
            try{
                Intent external=Intent.parseUri(uri.toString(),Intent.URI_INTENT_SCHEME);
                Uri data=external.getData();
                if(data!=null&&("whatsapp".equalsIgnoreCase(data.getScheme())||"wa.me".equalsIgnoreCase(data.getHost())||"api.whatsapp.com".equalsIgnoreCase(data.getHost())))return openExternal(data);
                String fallback=external.getStringExtra("browser_fallback_url");
                if(data!=null&&"https".equalsIgnoreCase(data.getScheme())){
                    String pkg=external.getPackage();
                    if("com.google.android.apps.maps".equals(pkg)){
                        try{startActivity(new Intent(Intent.ACTION_VIEW,data).setPackage(pkg).addCategory(Intent.CATEGORY_BROWSABLE));return true;}catch(android.content.ActivityNotFoundException ignored){}
                    }
                    if(fallback!=null&&fallback.startsWith("https://"))return openExternal(Uri.parse(fallback));
                    return openExternal(data);
                }
            }catch(java.net.URISyntaxException ignored){}
            Toast.makeText(this,"Não foi possível abrir este link externo",Toast.LENGTH_LONG).show();
            return true;
        }
        if(!("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme)||"whatsapp".equalsIgnoreCase(scheme)||"tel".equalsIgnoreCase(scheme)||"mailto".equalsIgnoreCase(scheme)))return true;
        String host=uri.getHost();
        boolean wa="whatsapp".equalsIgnoreCase(scheme)||"wa.me".equalsIgnoreCase(host)||"api.whatsapp.com".equalsIgnoreCase(host)||"web.whatsapp.com".equalsIgnoreCase(host);
        if(wa){
            String phone="wa.me".equalsIgnoreCase(host)?uri.getLastPathSegment():uri.getQueryParameter("phone");
            if(phone==null)phone="";phone=phone.replaceAll("[^0-9]","");
            if(!phone.matches("55[0-9]{10,11}")){Toast.makeText(this,"Número de WhatsApp inválido",Toast.LENGTH_LONG).show();return true;}
            Uri.Builder link=new Uri.Builder().scheme("https").authority("wa.me").path("/"+phone);
            String message=uri.getQueryParameter("text");if(message!=null&&!message.isEmpty())link.appendQueryParameter("text",message);
            for(String pkg:new String[]{"com.whatsapp","com.whatsapp.w4b"}){
                try{startActivity(new Intent(Intent.ACTION_VIEW,link.build()).setPackage(pkg).addCategory(Intent.CATEGORY_BROWSABLE));return true;}catch(android.content.ActivityNotFoundException|SecurityException ignored){}
            }
            uri=new Uri.Builder().scheme("https").authority("api.whatsapp.com").path("/send").appendQueryParameter("phone",phone).build();
        }
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(android.content.ActivityNotFoundException e){Toast.makeText(this,"Não foi possível abrir. Instale o WhatsApp ou um navegador.",Toast.LENGTH_LONG).show();}
        return true;
    }

    private void loadHtmlPage(String url) {
        loadingHtmlManually = true;
        loading.setVisibility(View.VISIBLE);
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);

        String safeUrl = url.replace("\\", "\\\\").replace("'", "\\'");
        String bootstrap = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>"
                + "<script>"
                + "fetch('" + safeUrl + "',{credentials:'include',cache:'no-store'})"
                + ".then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})"
                + ".then(function(html){document.open();document.write(html);document.close();})"
                + ".catch(function(e){document.body.textContent='Falha ao carregar SaintsAI: '+e.message;});"
                + "</script></body></html>";

        webView.loadDataWithBaseURL(url, bootstrap, "text/html", "UTF-8", url);
        loadingHtmlManually = false;
    }

    @Override protected void onResume(){super.onResume();if(security!=null)security.resume();}
    @Override protected void onPause(){if(security!=null)security.pause();super.onPause();}

    @Override
    public void onBackPressed() {
        if(security!=null&&security.isLocked()){finish();return;}
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onActivityResult(int code,int result,android.content.Intent data){if(security!=null&&security.result(code,result))return;super.onActivityResult(code,result,data);}
    @Override protected void onDestroy(){if(security!=null)security.destroy();if(webView!=null)webView.destroy();super.onDestroy();}

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
