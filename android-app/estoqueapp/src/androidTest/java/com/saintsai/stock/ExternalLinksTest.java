package com.saintsai.stock;
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
import static androidx.test.espresso.intent.VerificationModes.times;
import static androidx.test.espresso.intent.matcher.IntentMatchers.*;
import static org.hamcrest.Matchers.*;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class ExternalLinksTest {
 private void assertRecordedIntents(org.hamcrest.Matcher<Intent> matcher,int expected){
  for(int attempt=0;attempt<30;attempt++){
   int found=0;
   for(Intent intent:Intents.getIntents())if(matcher.matches(intent))found++;
   if(found==expected)return;
   try{Thread.sleep(100);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new AssertionError(e);}
  }
  throw new AssertionError("Expected "+expected+" matching external intents: "+matcher);
 }
 private WebView web(MainActivity a){try{Field f=MainActivity.class.getDeclaredField("webView");f.setAccessible(true);return(WebView)f.get(a);}catch(Exception e){throw new AssertionError(e);}}
 private WebResourceRequest request(String url,boolean main){return new WebResourceRequest(){public Uri getUrl(){return Uri.parse(url);}public boolean isForMainFrame(){return main;}public boolean isRedirect(){return true;}public boolean hasGesture(){return true;}public String getMethod(){return"GET";}public Map<String,String> getRequestHeaders(){return Collections.emptyMap();}};}
 @Test public void redirectsAndJavascriptBridgeOpenNativeWhatsApp()throws Exception{
  Intents.init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));
   String[] urls={"whatsapp://send/?phone=5544991001088&text&type=phone_number&app_absent=0&wame_ctl=1","https://api.whatsapp.com/send/?phone=5544991001088","https://wa.me/5544991001088","intent://send?phone=5544991001088#Intent;scheme=whatsapp;package=com.whatsapp;end;"};
   for(int i=0;i<urls.length;i++){
    final String url=urls[i];final boolean main=i==2;
    scenario.onActivity(a->{WebView w=web(a);w.stopLoading();assertTrue(w.getWebViewClient().shouldOverrideUrlLoading(w,request(url,main)));});
    assertRecordedIntents(allOf(hasPackage("com.whatsapp"),hasData(Uri.parse("https://wa.me/5544991001088"))),i+1);
   }
   CountDownLatch loaded=new CountDownLatch(1),done=new CountDownLatch(1);
   scenario.onActivity(a->{WebView w=web(a);w.stopLoading();w.setWebViewClient(new android.webkit.WebViewClient(){@Override public void onPageFinished(WebView v,String url){loaded.countDown();}});w.loadDataWithBaseURL("https://saintsai.test/","<html><body>Teste</body></html>","text/html","UTF-8",null);});
   assertTrue(loaded.await(8,TimeUnit.SECONDS));
   scenario.onActivity(a->web(a).evaluateJavascript("AndroidClient.openWhatsApp('5544991001088'); 'ok';",v->done.countDown()));
   assertTrue(done.await(8,TimeUnit.SECONDS));
   androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   assertRecordedIntents(allOf(hasPackage("com.whatsapp"),hasData(Uri.parse("https://wa.me/5544991001088"))),5);
  }finally{Intents.release();}
 }
 @Test public void deliveryMapEmbedStaysInsideAppButMapLinksOpenExternally()throws Exception{
  Intents.init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,null));
   scenario.onActivity(a->{WebView w=web(a);w.stopLoading();
    assertFalse(w.getWebViewClient().shouldOverrideUrlLoading(w,request("https://maps.google.com/maps?q=-23.58,-51.57&output=embed",false)));
    assertFalse(w.getWebViewClient().shouldOverrideUrlLoading(w,request("https://www.google.com/maps?q=-23.58,-51.57&output=embed",false)));
    assertFalse(w.getWebViewClient().shouldOverrideUrlLoading(w,request("https://www.google.com/maps/embed?pb=example",false)));
    assertTrue(w.getWebViewClient().shouldOverrideUrlLoading(w,request("https://www.google.com/maps?q=-23.58,-51.57",true)));
   });
   assertRecordedIntents(allOf(hasAction(Intent.ACTION_VIEW),hasData(Uri.parse("https://www.google.com/maps?q=-23.58,-51.57"))),1);
  }finally{Intents.release();}
 }

}
