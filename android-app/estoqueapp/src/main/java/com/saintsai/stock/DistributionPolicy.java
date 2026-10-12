package com.saintsai.stock;
import android.net.Uri;
import java.util.Locale;
/** Store builds are consumption-only; physical-service payments remain separate. */
public final class DistributionPolicy {
    private DistributionPolicy() {}
    public static boolean blocked(Uri uri) {
        String path=uri.getPath()==null?"":uri.getPath().toLowerCase(Locale.ROOT);
        return path.endsWith(".apk") || path.endsWith("/comprar.html") || (path.endsWith("/cliente-plano.html") || path.endsWith("/plano.html")) || path.endsWith("/cliente-acesso.html");
    }
}
