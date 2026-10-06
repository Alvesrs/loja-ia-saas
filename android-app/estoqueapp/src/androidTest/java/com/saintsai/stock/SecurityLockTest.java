package com.saintsai.stock;

import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.Until;
import android.view.KeyEvent;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SecurityLockTest {
 @Test public void persistedLockHidesContentAndCancellationDoesNotUnlock(){
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{
    context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",true).commit();
    FrameLayout root=new FrameLayout(activity);WebView web=new WebView(activity);root.addView(web);
    SaintsSecurity gate=new SaintsSecurity(activity,root,web,"https://backend-prod-production-f338.up.railway.app/");
    assertTrue(gate.isLocked());assertEquals(View.VISIBLE,root.getChildAt(root.getChildCount()-1).getVisibility());
    assertTrue((activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_SECURE)!=0);
    gate.pause();assertTrue(gate.isLocked());gate.result(8051,android.app.Activity.RESULT_CANCELED);assertTrue(gate.isLocked());
    gate.destroy();web.destroy();
    context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();
   });
  }finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
 }

 @Test public void devicePinUnlocksAfterSystemConfirmation() throws Exception {
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",true).commit();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  device.pressHome();
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   // Sem digital cadastrada no emulador, o Android mostra o PIN do aparelho.
   boolean pin=device.wait(Until.hasObject(By.res("com.android.systemui","key1")),15000);
   if(!pin){androidx.test.uiautomator.UiObject2 fallback=device.findObject(By.textContains("PIN"));if(fallback!=null)fallback.click();pin=device.wait(Until.hasObject(By.res("com.android.systemui","key1")),10000);}
   assertTrue("PIN do sistema não apareceu",pin);
   for(int number=1;number<=4;number++){androidx.test.uiautomator.UiObject2 key=device.findObject(By.res("com.android.systemui","key"+number));assertNotNull(key);key.click();}
   androidx.test.uiautomator.UiObject2 enter=device.findObject(By.res("com.android.systemui","key_enter"));
   if(enter!=null)enter.click();else device.pressKeyCode(KeyEvent.KEYCODE_ENTER);
   AtomicBoolean unlocked=new AtomicBoolean(false);
   for(int i=0;i<50&&!unlocked.get();i++){Thread.sleep(100);scenario.onActivity(activity->{try{java.lang.reflect.Field f=MainActivity.class.getDeclaredField("security");f.setAccessible(true);unlocked.set(!((SaintsSecurity)f.get(activity)).isLocked());}catch(Exception e){throw new RuntimeException(e);}});}
   assertTrue("Confirmação do PIN não desbloqueou o aplicativo",unlocked.get());
  }finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
 }
}
