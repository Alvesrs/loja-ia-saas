package com.saintsai.stock;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
public final class AppIconBridge {
 private final Activity activity;private final WebView web;
 public AppIconBridge(Activity activity,WebView web){this.activity=activity;this.web=web;}
 private boolean trusted(){try{Uri u=Uri.parse(web.getUrl());return "https".equals(u.getScheme())&&("backend-prod-production-f338.up.railway.app".equals(u.getHost())||("ldpiryzsunxwuhyvvogg.supabase.co".equals(u.getHost())&&u.getPath().startsWith("/functions/v1/saintsai-proxy/")));}catch(Exception e){return false;}}
 @JavascriptInterface public String getIcon(){return activity.getSharedPreferences("saintsai_icon",0).getString("choice","Default");}
 @JavascriptInterface public boolean setIcon(String choice){if(!trusted()||!("Default".equals(choice)||"Light".equals(choice)||"Gold".equals(choice)||"Mint".equals(choice)))return false;try{PackageManager pm=activity.getPackageManager();String prefix=activity.getPackageName()+".Icon";pm.setComponentEnabledSetting(new ComponentName(activity,prefix+choice),PackageManager.COMPONENT_ENABLED_STATE_ENABLED,PackageManager.DONT_KILL_APP);for(String other:new String[]{"Default","Light","Gold","Mint"})if(!choice.equals(other))pm.setComponentEnabledSetting(new ComponentName(activity,prefix+other),PackageManager.COMPONENT_ENABLED_STATE_DISABLED,PackageManager.DONT_KILL_APP);activity.getSharedPreferences("saintsai_icon",0).edit().putString("choice",choice).apply();return true;}catch(Exception e){return false;}}
 @JavascriptInterface public boolean pinCustom(String data){if(!trusted()||android.os.Build.VERSION.SDK_INT<26||data==null||data.length()>70000||!data.startsWith("data:image/png;base64,"))return false;try{byte[] bytes=android.util.Base64.decode(data.substring(data.indexOf(',')+1),android.util.Base64.DEFAULT);BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);if(bounds.outWidth<1||bounds.outHeight<1||bounds.outWidth>512||bounds.outHeight>512)return false;Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length);ShortcutManager manager=activity.getSystemService(ShortcutManager.class);if(manager==null||!manager.isRequestPinShortcutSupported())return false;Intent intent=new Intent(activity,MainActivity.class).setAction(Intent.ACTION_VIEW);ShortcutInfo shortcut=new ShortcutInfo.Builder(activity,"saintsai-custom-icon").setShortLabel("SaintsAI").setIcon(Icon.createWithBitmap(bitmap)).setIntent(intent).build();return manager.requestPinShortcut(shortcut,null);}catch(Exception e){return false;}}
}
