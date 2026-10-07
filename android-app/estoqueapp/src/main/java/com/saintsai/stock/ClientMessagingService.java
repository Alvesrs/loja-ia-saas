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
        if (title == null || title.isBlank()) title = "SaintsAI";
        if (body == null || body.isBlank()) body = "Você tem uma nova atualização.";

        boolean sale="venda_recebida".equals(message.getData().get("tipo"))||"pagamento_confirmado".equals(message.getData().get("tipo"));
        if(sale){try{double amount=Double.parseDouble(message.getData().get("valor"));if(amount>0){String value=java.text.NumberFormat.getCurrencyInstance(new java.util.Locale("pt","BR")).format(amount);String custom=getSharedPreferences("saintsai_client_push",MODE_PRIVATE).getString("sale_message","Venda concluída! Você recebeu {valor}.");if(!custom.isBlank())body=custom.contains("{valor}")?custom.replace("{valor}",value):custom+" · "+value;}}catch(Exception ignored){}}
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 101, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, sale?"saintsai_sales_v1":MainActivity.CHANNEL_CLIENT)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi);

        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.notify((int)(System.currentTimeMillis() & 0xfffffff), b.build());
    }
}
