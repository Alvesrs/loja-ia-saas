package com.saintsai.stock;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class DistributionPolicyTest {
 @Test public void storeRoutesDoNotLeadToSaasCheckoutOrSideloads(){
  for(String path:new String[]{"/comprar.html","/cliente/cliente-plano.html?x=1","/cliente/plano.html","/cliente/cliente-acesso.html","/downloads/SaintsAI-Cliente.apk"})assertTrue(DistributionPolicy.blocked(Uri.parse("https://example.test"+path)));
 }
 @Test public void operationalAndPhysicalServicePaymentRoutesStayAvailable(){
  for(String path:new String[]{"/cliente/cliente-agenda.html","/cliente/cliente-configuracao.html?etapa=pagamentos","/cliente/cliente-recuperar.html","/exclusao-de-dados"})assertFalse(DistributionPolicy.blocked(Uri.parse("https://example.test"+path)));
 }
}
