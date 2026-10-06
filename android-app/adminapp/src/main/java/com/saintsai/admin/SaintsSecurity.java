package com.saintsai.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.concurrent.Executor;

/** Bloqueio local; não recebe digital e não substitui a autenticação no servidor. */
public final class SaintsSecurity {
    private static final int CREDENTIAL_REQUEST=8051;
    private final Activity activity;
    private final WebView web;
    private final SharedPreferences prefs;
    private final LinearLayout cover;
    private final TextView message;
    private final String allowedPrefix;
    private boolean unlocked=false, active=false, pending=false, credentialPending=false;
    private Boolean toggleTarget=null;
    private CancellationSignal cancellation;

    public SaintsSecurity(Activity activity,FrameLayout root,WebView web,String allowedPrefix){
        this.activity=activity;this.web=web;this.allowedPrefix=allowedPrefix;
        prefs=activity.getSharedPreferences("saintsai_security",Context.MODE_PRIVATE);
        cover=new LinearLayout(activity);cover.setOrientation(LinearLayout.VERTICAL);cover.setGravity(Gravity.CENTER);
        cover.setPadding(48,48,48,48);cover.setBackgroundColor(Color.rgb(16,14,24));cover.setClickable(true);
        cover.setFocusable(true);cover.setFocusableInTouchMode(true);
        message=new TextView(activity);message.setTextColor(Color.WHITE);message.setTextSize(19);message.setGravity(Gravity.CENTER);
        message.setText("SaintsAI protegido\n\nDesbloqueie para acessar seus dados.");cover.addView(message);
        Button unlock=new Button(activity);unlock.setText("Desbloquear");unlock.setOnClickListener(v->authenticate());cover.addView(unlock);
        root.addView(cover,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        if(enabled())lock();else cover.setVisibility(View.GONE);
    }
    private boolean enabled(){return prefs.getBoolean("enabled",false);}
    private boolean trusted(){String url=web.getUrl();return url!=null&&url.startsWith(allowedPrefix);}
    private KeyguardManager keyguard(){return (KeyguardManager)activity.getSystemService(Context.KEYGUARD_SERVICE);}
    private void lock(){unlocked=false;cover.setVisibility(View.VISIBLE);cover.bringToFront();cover.requestFocus();activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);}
    public void resume(){active=true;if(enabled()&&!unlocked){lock();if(!credentialPending&&!pending)authenticate();}}
    public void pause(){active=false;if(enabled())lock();if(pending&&!credentialPending&&cancellation!=null)cancellation.cancel();}
    public boolean isLocked(){return enabled()&&!unlocked;}
    @JavascriptInterface public String getSecurityStatus(){return "{\"supported\":true,\"enabled\":"+enabled()+"}";}
    @JavascriptInterface public void requestSecurityToggle(){activity.runOnUiThread(()->{if(!trusted()||pending||credentialPending)return;toggleTarget=!enabled();authenticate();});}
    private void authenticate(){
        if(!active||pending||credentialPending)return;
        if(!keyguard().isDeviceSecure()){
            message.setText("Configure um bloqueio de tela no Android para proteger seus dados.");
            if(toggleTarget!=null){toggleTarget=null;new AlertDialog.Builder(activity).setTitle("Bloqueio do celular necessário").setMessage("Cadastre sua digital ou configure um PIN nas configurações do Android e tente novamente.").setPositiveButton("OK",null).show();}
            return;
        }
        if(Build.VERSION.SDK_INT<28){showCredential();return;}
        Executor executor=activity::runOnUiThread;
        BiometricPrompt.Builder b=new BiometricPrompt.Builder(activity).setTitle("Desbloquear SaintsAI").setSubtitle("Use sua digital, biometria ou PIN do celular");
        if(Build.VERSION.SDK_INT>=30)b.setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG|android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        else b.setNegativeButton("Usar PIN",executor,(dialog,which)->{pending=false;showCredential();});
        cancellation=new CancellationSignal();pending=true;
        b.build().authenticate(cancellation,executor,new BiometricPrompt.AuthenticationCallback(){
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){pending=false;if(active)success();}
            @Override public void onAuthenticationError(int code,CharSequence text){pending=false;if(credentialPending)return;if(Build.VERSION.SDK_INT<30&&(code==11||code==12||code==7||code==9)){if(active)showCredential();return;}toggleTarget=null;message.setText("SaintsAI protegido\n\nToque em desbloquear para tentar novamente.");}
            @Override public void onAuthenticationFailed(){message.setText("Biometria não reconhecida. Tente novamente.");}
        });
    }
    private void showCredential(){Intent intent=keyguard().createConfirmDeviceCredentialIntent("Desbloquear SaintsAI","Confirme o bloqueio do celular para acessar seus dados.");if(intent==null){toggleTarget=null;return;}credentialPending=true;pending=false;activity.startActivityForResult(intent,CREDENTIAL_REQUEST);}
    public boolean result(int code,int result){if(code!=CREDENTIAL_REQUEST)return false;credentialPending=false;if(result==Activity.RESULT_OK){active=true;success();}else{toggleTarget=null;message.setText("SaintsAI protegido\n\nDesbloqueio cancelado.");}return true;}
    private void success(){
        if(toggleTarget!=null){prefs.edit().putBoolean("enabled",toggleTarget).apply();toggleTarget=null;}
        unlocked=true;cover.setVisibility(View.GONE);web.requestFocus();
        if(enabled())activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        web.evaluateJavascript("window.dispatchEvent(new Event('saintsai-security-change'))",null);
    }
    public void destroy(){if(cancellation!=null)cancellation.cancel();}
}
