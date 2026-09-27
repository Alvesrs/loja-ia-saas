package com.saintsai.sales;

import android.app.Application;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class SalesApp extends Application {
    @Override public void onCreate() {
        super.onCreate();
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApplicationId("1:962056817294:android:dd32be0268618c0d0917df")
                .setApiKey("AIzaSyB_V_dh4rK7pEdSaHxSYvnE1CKxwqRtSCI")
                .setProjectId("saintsai-7fe77")
                .setGcmSenderId("962056817294")
                .setStorageBucket("saintsai-7fe77.firebasestorage.app")
                .build();
            FirebaseApp.initializeApp(this, options);
        }
    }
}
