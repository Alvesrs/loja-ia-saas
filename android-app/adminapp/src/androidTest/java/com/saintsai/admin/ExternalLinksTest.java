package com.saintsai.admin;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.intent.Intents;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static androidx.test.espresso.intent.Intents.*;
import static androidx.test.espresso.intent.matcher.IntentMatchers.*;
import static org.hamcrest.Matchers.*;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class ExternalLinksTest {
 private WebView web(MainActivity a){try{Field f=MainActivity.class.getDeclaredField("webView");f.setAccessible(true);return(WebView)f.get(a);}catch(Exception e){throw new AssertionError(e);}}
 private WebResourceRequest request(String url,boolean main){return new WebResourceRequest(){public Uri getUrl(){return Uri.parse(url);}public boolean isForMainFrame(){return main;}public boolean isRedirect(){return true;}public boolean hasGesture(){return true;}public String getMethod(){return"GET";}public Map<String,String> getRequestHeaders(){return Collections.emptyMap();}};}
 private void redirect(String url,boolean main,String expectedPhone){
  Intents.init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));
   scenario.onActivity(a->{WebView w=web(a);w.stopLoading();assertTrue(w.getWebViewClient().shouldOverrideUrlLoading(w,request(url,main)));});
   intended(allOf(hasAction(Intent.ACTION_VIEW),hasPackage("com.whatsapp"),hasData(Uri.parse("whatsapp://send?phone="+expectedPhone))));
  }finally{Intents.release();}
 }
 @Test public void exactReportedWhatsAppRedirectIsExternalEvenInSubframe(){redirect("whatsapp://send/?phone=5544991001088&text&type=phone_number&app_absent=0&wame_ctl=1",false,"5544991001088");}
 @Test public void httpsWhatsAppRedirectIsExternalEvenInSubframe(){redirect("https://api.whatsapp.com/send/?phone=5544991001088",false,"5544991001088");}
 @Test public void mainFrameStillOpensWhatsApp(){redirect("https://wa.me/5544991001088",true,"5544991001088");}
 @Test public void wrappedWhatsAppIntentNeverLoadsInWebView(){redirect("intent://send?phone=5544991001088#Intent;scheme=whatsapp;package=com.whatsapp;end;",false,"5544991001088");}
 @Test public void javascriptBridgeOpensNativeWhatsApp()throws Exception{
  Intents.init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));
   CountDownLatch loaded=new CountDownLatch(1),done=new CountDownLatch(1);
   scenario.onActivity(a->{WebView w=web(a);w.stopLoading();w.setWebViewClient(new android.webkit.WebViewClient(){@Override public void onPageFinished(WebView v,String url){loaded.countDown();}});w.loadDataWithBaseURL("https://saintsai.test/","<html><body>Teste</body></html>","text/html","UTF-8",null);});
   assertTrue(loaded.await(8,TimeUnit.SECONDS));
   scenario.onActivity(a->{WebView w=web(a);w.evaluateJavascript("AndroidAgent.openWhatsApp('5544991001088'); 'ok';",v->done.countDown());});
   assertTrue(done.await(8,TimeUnit.SECONDS));
   androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   intended(allOf(hasPackage("com.whatsapp"),hasData(Uri.parse("whatsapp://send?phone=5544991001088"))));
  }finally{Intents.release();}
 }
 @Test public void updateBridgeQueuesTheAgentApkDownload()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(a->{
    android.app.DownloadManager dm=(android.app.DownloadManager)a.getSystemService(Activity.DOWNLOAD_SERVICE);
    java.util.Set<Long> before=new java.util.HashSet<>();
    try(android.database.Cursor c=dm.query(new android.app.DownloadManager.Query())){while(c.moveToNext())before.add(c.getLong(c.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_ID)));}
    a.new AgentBridge().installLatest();
    boolean found=false;
    try(android.database.Cursor c=dm.query(new android.app.DownloadManager.Query())){while(c.moveToNext()){
      long id=c.getLong(c.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_ID));
      if(!before.contains(id)){assertEquals("https://raw.githubusercontent.com/Alvesrs/loja-ia-saas/main/downloads/Agente-SaintsAI.apk",c.getString(c.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_URI)));found=true;dm.remove(id);}
    }}assertTrue("APK download was queued",found);
   });
  }
 }
}
