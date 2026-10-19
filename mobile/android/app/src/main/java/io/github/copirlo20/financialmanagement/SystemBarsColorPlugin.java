package io.github.copirlo20.financialmanagement;

import android.content.res.Configuration;
import android.graphics.Color;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

// What shows behind the transparent system bars (the app is drawn edge to edge) and behind the page while it
// loads. Until the page has painted: the start screen, the logo on violet, instead of a white flash. Then:
// the colour at the top of the page, with dark or light icons to match, so that the site's dark theme does
// not sit between two white bars. The page reports that colour through res/raw/system_bars.js, which this
// plugin runs after every page load.
//
// Capacitor's own SystemBars plugin repaints the window when it starts and when the phone switches between
// light and dark; it is loaded before this one, so posting to the main thread here runs after it.
@CapacitorPlugin(name = "SystemBarsColor")
public class SystemBarsColorPlugin extends Plugin {

    private Integer colour;
    private WebViewListener pageListener;

    @Override
    public void load() {
        getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
        getBridge().executeOnMainThread(this::apply);
    }

    // Not in load(): the bridge replaces its list of WebView listeners after loading the plugins, which would
    // drop one added there. Capacitor's SystemBars plugin adds its own here for the same reason.
    @Override
    protected void handleOnStart() {
        if (pageListener != null) return;
        String script = readScript();
        pageListener = new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
                view.evaluateJavascript(script, null);
            }
        };
        getBridge().addWebViewListener(pageListener);
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        getBridge().executeOnMainThread(this::apply);
    }

    @PluginMethod
    public void set(PluginCall call) {
        colour = Color.rgb(channel(call, "r"), channel(call, "g"), channel(call, "b"));
        getBridge().executeOnMainThread(this::apply);
        call.resolve();
    }

    private void apply() {
        Window window = getActivity().getWindow();
        if (colour == null) {
            window.getDecorView().setBackgroundResource(R.drawable.splash);
        } else {
            window.getDecorView().setBackgroundColor(colour);
        }
        boolean light = colour != null && ColorUtils.calculateLuminance(colour) > 0.5;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }

    private String readScript() {
        try (InputStream stream = getContext().getResources().openRawResource(R.raw.system_bars)) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }

    private static int channel(PluginCall call, String name) {
        Integer value = call.getInt(name, 255);
        return Math.max(0, Math.min(255, value == null ? 255 : value));
    }
}
