package com.saintsai.stock;

import android.view.View;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
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
    assertEquals("Cliente deve permitir prints mesmo com biometria",0,activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_SECURE);
    gate.pause();assertTrue(gate.isLocked());gate.result(8051,android.app.Activity.RESULT_CANCELED);assertTrue(gate.isLocked());
    gate.destroy();web.destroy();
    context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();
   });
  }finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
 }

 @Test public void trustedFilePickerDoesNotRelockUnlockedApp() throws Exception {
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",true).commit();
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{
    FrameLayout root=new FrameLayout(activity);WebView web=new WebView(activity);root.addView(web);
    SaintsSecurity gate=new SaintsSecurity(activity,root,web,"https://backend-prod-production-f338.up.railway.app/");
    try{
      java.lang.reflect.Field unlocked=SaintsSecurity.class.getDeclaredField("unlocked");
      unlocked.setAccessible(true);unlocked.setBoolean(gate,true);
    }catch(Exception e){throw new RuntimeException(e);}
    gate.beginTrustedExternalFlow();
    gate.pause();
    assertFalse("Abrir a galeria não pode bloquear o app",gate.isLocked());
    gate.resume();
    assertFalse("Voltar do seletor não pode pedir biometria de novo",gate.isLocked());
    gate.endTrustedExternalFlow();
    gate.pause();
    assertTrue("Depois do seletor, sair do app deve voltar a bloquear",gate.isLocked());
    gate.destroy();web.destroy();
   });
  }finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
 }

 @Test public void multiplePickerResultReturnsAllSelectedUris(){
  Intent data=new Intent();
  android.content.ClipData clip=android.content.ClipData.newRawUri("m1",Uri.parse("content://media/1"));
  clip.addItem(new android.content.ClipData.Item(Uri.parse("content://media/2")));
  data.setClipData(clip);
  Uri[] result=MainActivity.collectSelectedUris(android.app.Activity.RESULT_OK,data);
  assertNotNull(result);assertEquals(2,result.length);
  assertEquals("content://media/1",result[0].toString());
  assertEquals("content://media/2",result[1].toString());
 }

 @Test public void singlePickerResultStillWorks(){
  Intent data=new Intent();data.setData(Uri.parse("content://media/single"));
  Uri[] result=MainActivity.collectSelectedUris(android.app.Activity.RESULT_OK,data);
  assertNotNull(result);assertEquals(1,result.length);assertEquals("content://media/single",result[0].toString());
 }

 @Test public void devicePinUnlocksAfterSystemConfirmation() throws Exception {
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",true).commit();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  device.pressHome();
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   // Sem digital cadastrada no emulador, o Android mostra o PIN do aparelho.
   androidx.test.uiautomator.UiObject2 password=device.wait(Until.findObject(By.res("com.android.systemui","lockPassword")),10000);
   if(password==null){androidx.test.uiautomator.UiObject2 fallback=device.findObject(By.textContains("PIN"));if(fallback!=null&&fallback.isClickable())fallback.click();password=device.wait(Until.findObject(By.res("com.android.systemui","lockPassword")),5000);}
   if(password!=null){password.click();password.setText("1234");device.pressKeyCode(KeyEvent.KEYCODE_ENTER);}
   else {
    // Compatibilidade com o teclado da tela de bloqueio em outras versões do Android.
    boolean pin=device.wait(Until.hasObject(By.res("com.android.systemui","key1")),5000);assertTrue("PIN do sistema não apareceu",pin);
    for(int number=1;number<=4;number++){androidx.test.uiautomator.UiObject2 key=device.findObject(By.res("com.android.systemui","key"+number));assertNotNull(key);key.click();}
    androidx.test.uiautomator.UiObject2 enter=device.findObject(By.res("com.android.systemui","key_enter"));if(enter!=null)enter.click();else device.pressKeyCode(KeyEvent.KEYCODE_ENTER);
   }
   AtomicBoolean unlocked=new AtomicBoolean(false);
   for(int i=0;i<50&&!unlocked.get();i++){Thread.sleep(100);scenario.onActivity(activity->{try{java.lang.reflect.Field f=MainActivity.class.getDeclaredField("security");f.setAccessible(true);unlocked.set(!((SaintsSecurity)f.get(activity)).isLocked());}catch(Exception e){throw new RuntimeException(e);}});}
   assertTrue("Confirmação do PIN não desbloqueou o aplicativo",unlocked.get());
  }finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
 }
 @Test public void notificationPermissionFlowDoesNotRelockButLeavingAppStillDoes(){
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{
    try{
     java.lang.reflect.Field field=MainActivity.class.getDeclaredField("security");field.setAccessible(true);
     SaintsSecurity gate=(SaintsSecurity)field.get(activity);
     java.lang.reflect.Field unlocked=SaintsSecurity.class.getDeclaredField("unlocked");unlocked.setAccessible(true);unlocked.setBoolean(gate,true);
     context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",true).commit();
     activity.beginNotificationFlow();assertTrue(activity.new ClientBridge().notificationRequestPending());
     gate.pause();gate.resume();assertFalse("A permissão de notificação não pode pedir digital novamente",gate.isLocked());
     activity.endNotificationFlow();assertFalse(activity.new ClientBridge().notificationRequestPending());
     gate.pause();assertTrue("Sair de verdade continua protegendo a conta",gate.isLocked());
     assertEquals("Prints devem ser permitidos",0,activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_SECURE);
    }catch(Exception e){throw new RuntimeException(e);}
    finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
   });
  }finally{context.getSharedPreferences("saintsai_security",0).edit().putBoolean("enabled",false).commit();}
 }

}
