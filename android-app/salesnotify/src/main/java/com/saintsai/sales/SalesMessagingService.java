package com.saintsai.sales;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class SalesMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        getSharedPreferences("saintsai_push", MODE_PRIVATE)
            .edit().putString("fcm_token", token).apply();
        // O envio ao backend será ligado após o Firebase do SaintsAI ser configurado.
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        String title = value(message, "title", "Nova venda 💰");
        String body = value(message, "body", "Uma nova venda foi registrada.");

        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this, 1001, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, MainActivity.CHANNEL_SALES)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending);

        NotificationManager nm = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        nm.notify((int)(System.currentTimeMillis() & 0x0fffffff), b.build());
    }

    private String value(RemoteMessage message, String key, String fallback) {
        String v = message.getData().get(key);
        if (v != null && !v.trim().isEmpty()) return v;
        if (message.getNotification() != null) {
            if ("title".equals(key) && message.getNotification().getTitle() != null) return message.getNotification().getTitle();
            if ("body".equals(key) && message.getNotification().getBody() != null) return message.getNotification().getBody();
        }
        return fallback;
    }
}
