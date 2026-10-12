package com.saintsai.stock;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class ClientMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        getSharedPreferences("saintsai_client_push", MODE_PRIVATE)
            .edit().putString("fcm_token", token).apply();
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        String title = message.getData().get("title");
        String body = message.getData().get("body");
        if (title == null || title.trim().isEmpty()) title = "SaintsAI";
        if (body == null || body.trim().isEmpty()) body = "Você tem uma nova atualização.";

        boolean sale="venda_recebida".equals(message.getData().get("tipo"))||"pagamento_confirmado".equals(message.getData().get("tipo"))||"teste_venda".equals(message.getData().get("tipo"));
        String channel=MainActivity.CHANNEL_CLIENT;
        if(sale){String sound=message.getData().get("som");channel=("pix".equals(sound)||"moedas".equals(sound)||"caixa".equals(sound))?"saintsai_sales_"+sound+("pix".equals(sound)?"_v2":"_v1"):"saintsai_sales_v1";}
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 101, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, channel)
            .setSmallIcon(sale?R.drawable.ic_notification_money:android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi);

        NotificationManager nm = getSystemService(NotificationManager.class);
        String bookingId=message.getData().get("agendamento_id");
        if(sale && bookingId!=null && !bookingId.trim().isEmpty())nm.notify("saintsai-sale-"+bookingId,0,b.setOnlyAlertOnce(true).build());
        else nm.notify((int)(System.currentTimeMillis() & 0xfffffff), b.build());
    }
}
