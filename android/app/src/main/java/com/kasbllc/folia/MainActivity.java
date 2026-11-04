package com.kasbllc.folia;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private TextToSpeech ttsEngine;
    private boolean ttsReady = false;
    private volatile String pendingSharedText = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initNativeTts();
        setupWebViewBridge();
        captureIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureIncomingIntent(intent);
    }

    private void initNativeTts() {
        try {
            ttsEngine = new TextToSpeech(getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady = true;
                    ttsEngine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            notifyWebViewTtsEvent("start", utteranceId);
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            notifyWebViewTtsEvent("done", utteranceId);
                        }

                        @Override
                        public void onError(String utteranceId) {
                            notifyWebViewTtsEvent("error", utteranceId);
                        }
                    });
                }
            });
        } catch (Exception ignored) {
            ttsReady = false;
        }
    }

    private void notifyWebViewTtsEvent(final String eventType, final String utteranceId) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    String safeEvent = JSONObject.quote(eventType != null ? eventType : "");
                    String safeId = JSONObject.quote(utteranceId != null ? utteranceId : "");
                    String js = "if (window.__foliaOnNativeTtsEvent) { window.__foliaOnNativeTtsEvent(" + safeEvent + ", " + safeId + "); }";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception ignored) {
            }
        });
    }

    private void setupWebViewBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                webView.addJavascriptInterface(new FoliaNativeBridge(), "FoliaNative");
            }
        } catch (Exception ignored) {
        }
    }

    private void captureIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String extracted = null;

        if (Intent.ACTION_SEND.equals(action)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (sharedText != null && !sharedText.trim().isEmpty()) {
                extracted = sharedSubject != null && !sharedSubject.trim().isEmpty()
                        ? sharedSubject.trim() + "\n" + sharedText.trim()
                        : sharedText.trim();
            }
        } else if (Intent.ACTION_VIEW.equals(action) && intent.getDataString() != null) {
            extracted = intent.getDataString().trim();
        }

        if (extracted != null && !extracted.isEmpty()) {
            pendingSharedText = extracted;
            final String payloadToSend = extracted;
            runOnUiThread(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String quoted = JSONObject.quote(payloadToSend);
                        String js = "if (window.__foliaOnSharedUrl) { window.__foliaOnSharedUrl(" + quoted + "); }";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception ignored) {
                }
            });
        }
    }

    @Override
    public void onDestroy() {
        try {
            if (ttsEngine != null) {
                ttsEngine.stop();
                ttsEngine.shutdown();
            }
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    public class FoliaNativeBridge {
        @JavascriptInterface
        public boolean isTtsAvailable() {
            return ttsReady && ttsEngine != null;
        }

        @JavascriptInterface
        public boolean speak(String text, String bcp47Lang, float rate, String utteranceId) {
            if (text == null || text.trim().isEmpty()) return false;
            try {
                if (!ttsReady || ttsEngine == null) {
                    initNativeTts();
                    return false;
                }
                if (bcp47Lang != null && !bcp47Lang.trim().isEmpty()) {
                    Locale loc = Locale.forLanguageTag(bcp47Lang.trim());
                    int res = ttsEngine.setLanguage(loc);
                    if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                        ttsEngine.setLanguage(Locale.getDefault());
                    }
                }
                float clampedRate = Math.max(0.5f, Math.min(2.5f, rate));
                ttsEngine.setSpeechRate(clampedRate);
                Bundle params = new Bundle();
                String id = (utteranceId != null && !utteranceId.isEmpty())
                        ? utteranceId
                        : "utt-" + System.currentTimeMillis();
                int result = ttsEngine.speak(text, TextToSpeech.QUEUE_FLUSH, params, id);
                return result == TextToSpeech.SUCCESS;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void stopSpeaking() {
            try {
                if (ttsEngine != null) {
                    ttsEngine.stop();
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public boolean isSpeaking() {
            try {
                return ttsEngine != null && ttsEngine.isSpeaking();
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String consumePendingSharedText() {
            String current = pendingSharedText;
            pendingSharedText = null;
            return current != null ? current : "";
        }

        @JavascriptInterface
        public String getClipboardText() {
            try {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null && clipboard.hasPrimaryClip()) {
                    ClipData clip = clipboard.getPrimaryClip();
                    if (clip != null && clip.getItemCount() > 0) {
                        CharSequence text = clip.getItemAt(0).coerceToText(getApplicationContext());
                        if (text != null) {
                            return text.toString();
                        }
                    }
                }
            } catch (Exception ignored) {
            }
            return "";
        }

        @JavascriptInterface
        public String fetchUrlHtml(String urlStr) {
            if (urlStr == null || urlStr.trim().isEmpty()) return "";
            HttpURLConnection conn = null;
            try {
                String cleanUrl = urlStr.trim();
                if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
                    cleanUrl = "https://" + cleanUrl;
                }
                URL url = new URL(cleanUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(7000);
                conn.setReadTimeout(7000);
                conn.setRequestMethod("GET");
                conn.setRequestProperty(
                        "User-Agent",
                        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
                );
                conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");

                int status = conn.getResponseCode();
                if (status == HttpURLConnection.HTTP_MOVED_TEMP
                        || status == HttpURLConnection.HTTP_MOVED_PERM
                        || status == HttpURLConnection.HTTP_SEE_OTHER
                        || status == 307
                        || status == 308) {
                    String newUrl = conn.getHeaderField("Location");
                    if (newUrl != null) {
                        conn.disconnect();
                        conn = (HttpURLConnection) new URL(newUrl).openConnection();
                        conn.setConnectTimeout(7000);
                        conn.setReadTimeout(7000);
                        conn.setRequestProperty(
                                "User-Agent",
                                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
                        );
                    }
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    int totalChars = 0;
                    while ((line = reader.readLine()) != null && totalChars < 600_000) {
                        sb.append(line).append('\n');
                        totalChars += line.length();
                    }
                }
                return sb.toString();
            } catch (Exception e) {
                return "";
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }
    }
}
