package com.saintsai.stock;

import android.graphics.Insets;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.*;

/** Device regression: native padding + CSS safe area + keyboard show/hide. */
@RunWith(AndroidJUnit4.class)
public class WindowInsetsTest {
    private WebView web;
    private static final String FIXTURE = "<!doctype html><html><head>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'>"
            + "<style>html,body{margin:0;background:#08070d;color:#fff;font:16px sans-serif}"
            + "main{min-height:100vh;box-sizing:border-box;padding:20px 16px 100px}"
            + "h1{color:#be8bff}input{font:inherit;padding:14px;width:80%}"
            + "#probe{padding:env(safe-area-inset-top) env(safe-area-inset-right) "
            + "env(safe-area-inset-bottom) env(safe-area-inset-left)}"
            + "#menu{position:fixed;bottom:0;left:0;right:0;background:#211331;"
            + "padding:8px 12px calc(8px + env(safe-area-inset-bottom));border-top:1px solid #9955ee}"
            + "#menu div{height:52px;display:flex;align-items:center;justify-content:space-around}"
            + "</style></head><body><main><h1>SaintsAI · teste de tela</h1>"
            + "<p>Conteúdo dentro das barras do Android.</p><input id='field' placeholder='Teste do teclado'>"
            + "<div id='probe'></div></main><nav id='menu'><div>Início · Agenda · Serviços · IA</div>"
            + "</nav></body></html>";

    @Test public void fillsSafeAreaWithoutDoublePaddingAndRestoresAfterKeyboard() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            CountDownLatch loaded = new CountDownLatch(1);
            scenario.onActivity(activity -> {
                web = findWebView(activity.findViewById(android.R.id.content));
                assertNotNull(web);
                web.stopLoading();
                // This fixture deliberately exercises the same CSS env() used by the portal.
                web.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView view, String url) {
                        ViewGroup parent = (ViewGroup) view.getParent();
                        for (int i = 0; i < parent.getChildCount(); i++) {
                            View child = parent.getChildAt(i);
                            child.setVisibility(child == view ? View.VISIBLE : View.GONE);
                        }
                        loaded.countDown();
                    }
                });
                web.loadDataWithBaseURL("https://layout-test.invalid/", FIXTURE, "text/html", "UTF-8", null);
            });
            assertTrue("Fixture loaded", loaded.await(20, TimeUnit.SECONDS));
            awaitStableLayout();
            assertBounds(scenario, false);
            assertWebInsets();
            int originalHeight = webHeight(scenario);
            screenshot(scenario, "safe-area.png");

            evaluate("document.getElementById('field').focus();true");
            scenario.onActivity(activity -> {
                web.requestFocus();
                ((InputMethodManager) activity.getSystemService(MainActivity.INPUT_METHOD_SERVICE))
                        .showSoftInput(web, InputMethodManager.SHOW_IMPLICIT);
            });
            awaitKeyboard(scenario, true);
            awaitStableLayout();
            assertBounds(scenario, true);
            assertTrue("Keyboard resizes visible content", webHeight(scenario) < originalHeight);
            assertWebInsets();
            screenshot(scenario, "keyboard.png");

            scenario.onActivity(activity -> ((InputMethodManager) activity.getSystemService(MainActivity.INPUT_METHOD_SERVICE))
                    .hideSoftInputFromWindow(web.getWindowToken(), 0));
            awaitKeyboard(scenario, false);
            awaitStableLayout();
            assertBounds(scenario, false);
            assertEquals("No ghost padding after keyboard closes", originalHeight, webHeight(scenario));
            assertWebInsets();
            screenshot(scenario, "keyboard-closed.png");
        }
    }

    private void assertBounds(ActivityScenario<MainActivity> scenario, boolean keyboard) {
        scenario.onActivity(activity -> {
            WindowInsets insets = activity.getWindow().getDecorView().getRootWindowInsets();
            assertNotNull(insets);
            int types = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
            if (keyboard) types |= WindowInsets.Type.ime();
            Insets safe = insets.getInsets(types);
            Rect window = activity.getWindowManager().getCurrentWindowMetrics().getBounds();
            int[] position = new int[2];
            web.getLocationOnScreen(position);
            assertEquals("Left edge", window.left + safe.left, position[0]);
            assertEquals("Top edge", window.top + safe.top, position[1]);
            assertEquals("Right edge", window.right - safe.right, position[0] + web.getWidth());
            assertEquals("Bottom edge", window.bottom - safe.bottom, position[1] + web.getHeight());
        });
    }

    private void assertWebInsets() throws Exception {
        String data = evaluate("JSON.stringify((()=>{const p=getComputedStyle(document.getElementById('probe'));"
                + "const m=document.getElementById('menu');const r=m.getBoundingClientRect();"
                + "return {top:parseFloat(p.paddingTop),bottom:parseFloat(p.paddingBottom),"
                + "left:parseFloat(p.paddingLeft),right:parseFloat(p.paddingRight),"
                + "menuPadding:parseFloat(getComputedStyle(m).paddingBottom),"
                + "gap:innerHeight-r.bottom,visualGap:innerHeight-visualViewport.height};})())");
        JSONObject result = new JSONObject((String) new org.json.JSONTokener(data).nextValue());
        for (String edge : new String[]{"top", "bottom", "left", "right"}) {
            assertEquals("CSS must not reserve " + edge + " twice", 0, result.getDouble(edge), 0.5);
        }
        assertEquals("Only designed menu padding remains", 8, result.getDouble("menuPadding"), 0.5);
        assertEquals("Menu reaches viewport bottom", 0, result.getDouble("gap"), 1.5);
        assertEquals("Web viewport is not resized twice", 0, result.getDouble("visualGap"), 1.5);
    }

    private String evaluate(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                web.evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("JavaScript completed", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void awaitKeyboard(ActivityScenario<MainActivity> scenario, boolean visible) {
        long deadline = SystemClock.uptimeMillis() + 10000;
        boolean[] matched = {false};
        while (SystemClock.uptimeMillis() < deadline) {
            scenario.onActivity(activity -> matched[0] = activity.getWindow().getDecorView()
                    .getRootWindowInsets().isVisible(WindowInsets.Type.ime()) == visible);
            if (matched[0]) return;
            SystemClock.sleep(100);
        }
        fail("Keyboard visibility did not become " + visible);
    }

    private void awaitStableLayout() {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        SystemClock.sleep(700); // Includes the platform IME/inset animation.
    }

    private int webHeight(ActivityScenario<MainActivity> scenario) {
        int[] result = {0};
        scenario.onActivity(activity -> result[0] = web.getHeight());
        return result[0];
    }

    private void screenshot(ActivityScenario<MainActivity> scenario, String name) {
        File dir = InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null);
        android.graphics.Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try (java.io.FileOutputStream output = new java.io.FileOutputStream(new File(dir, name))) {
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output);
        } catch (java.io.IOException exception) { throw new AssertionError(exception); }
        finally { bitmap.recycle(); }
    }

    private WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
}
