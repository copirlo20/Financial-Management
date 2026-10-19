package io.github.copirlo20.financialmanagement;

import android.app.DownloadManager;
import android.content.Context;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The system bars take the colour of the page.
        registerPlugin(SystemBarsColorPlugin.class);
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();

        // Back goes to the previous page, as in a browser; only on the first page does it leave the app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        // The WebView saves no files itself: a download (the statement PDF, the import template) goes to the
        // system's download manager, with the session cookies so that the server lets it through.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            String cookies = CookieManager.getInstance().getCookie(url);
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .addRequestHeader("Cookie", cookies)
                .addRequestHeader("User-Agent", userAgent)
                .setMimeType(mimeType)
                .setTitle(fileName)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            try {
                getSystemService(DownloadManager.class).enqueue(request);
                Toast.makeText(this, inAppLanguage(cookies).getString(R.string.download_started, fileName), Toast.LENGTH_SHORT).show();
            } catch (RuntimeException error) {
                // Android 9 and older need a storage permission for the Downloads folder, which the app does not ask for.
                Toast.makeText(this, inAppLanguage(cookies).getString(R.string.download_failed), Toast.LENGTH_LONG).show();
            }
        });
    }

    // The language picked in the app (the site's "locale" cookie, Vietnamese unless English was chosen), so
    // that messages match the page rather than the phone's language.
    private Context inAppLanguage(String cookies) {
        boolean english = cookies != null && Pattern.compile("(^|;\\s*)locale=en(;|$)").matcher(cookies).find();
        Configuration configuration = new Configuration(getResources().getConfiguration());
        configuration.setLocale(english ? Locale.ENGLISH : Locale.forLanguageTag("vi"));
        return createConfigurationContext(configuration);
    }

    // The WebView writes cookies to disk only every half minute or so: an app swiped away soon after signing
    // in would lose the session. Leaving the screen is the last moment the app can be sure to run.
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
