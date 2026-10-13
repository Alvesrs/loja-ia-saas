package com.saintsai.stock;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class AppIconSwitchTest {
 @Test public void switchesOneLauncherAtATimeAndRejectsForeignPage(){
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{
    WebView trusted=new WebView(activity){@Override public String getUrl(){return "https://backend-prod-production-f338.up.railway.app/painel/admin-marketing.html";}};
    AppIconBridge bridge=new AppIconBridge(activity,trusted);
    try{for(String choice:new String[]{"Gold","Mint","Light","Default"}){assertTrue(bridge.setIcon(choice));assertEquals(choice,bridge.getIcon());int enabled=0;for(String name:new String[]{"Default","Light","Gold","Mint"})if(activity.getPackageManager().getComponentEnabledSetting(new ComponentName(activity,activity.getPackageName()+".Icon"+name))==PackageManager.COMPONENT_ENABLED_STATE_ENABLED)enabled++;assertEquals(1,enabled);}assertFalse(bridge.setIcon("Unknown"));WebView foreign=new WebView(activity){@Override public String getUrl(){return "https://backend-prod-production-f338.up.railway.app.attacker.test/";}};assertFalse(new AppIconBridge(activity,foreign).setIcon("Gold"));foreign.destroy();}finally{bridge.setIcon("Default");trusted.destroy();}
   });
  }
 }
}
