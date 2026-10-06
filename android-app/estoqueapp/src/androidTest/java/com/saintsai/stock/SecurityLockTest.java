package com.saintsai.stock;

import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
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
}
