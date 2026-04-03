import { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Easing,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgUri } from "react-native-svg";
import WebView, { WebViewNavigation } from "react-native-webview";

const APP_URL = "https://freshbybrham.com/";
const LOGO_URL =
  "https://freshbybrham.com/wp-content/uploads/2025/12/Fresh-By-Brham-2.svg";

const EXTERNAL_SCHEMES = [
  "mailto:",
  "tel:",
  "sms:",
  "whatsapp:",
  "instagram:",
  "tg:",
  "maps:",
  "geo:",
  "intent:",
];

function isInternalUrl(url: string): boolean {
  try {
    const target = new URL(url);
    const app = new URL(APP_URL);

    return target.host === app.host || target.host.endsWith(`.${app.host}`);
  } catch {
    return false;
  }
}

function shouldOpenExternally(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  if (EXTERNAL_SCHEMES.some((scheme) => lowerUrl.startsWith(scheme))) {
    return true;
  }

  if (lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://")) {
    return !isInternalUrl(url);
  }

  return false;
}

export default function HomeScreen() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const loadLineAnim = useRef(new Animated.Value(0)).current;
  const [hasError, setHasError] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isLoadLineComplete, setIsLoadLineComplete] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    canGoBackRef.current = navState.canGoBack;
  }, []);

  const onShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const url = request.url;

      if (!shouldOpenExternally(url)) {
        return true;
      }

      Linking.openURL(url).catch(() => {
        // Intentionally ignored. Failed external opens are non-fatal for this stop-gap app.
      });

      return false;
    },
    [],
  );

  const retry = useCallback(() => {
    setHasError(false);
    setIsPageLoaded(false);
    setIsLoadLineComplete(false);
    setReloadKey((current) => current + 1);
  }, []);

  const onError = useCallback(() => {
    setHasError(true);
  }, []);

  const startLoadLine = useCallback(() => {
    loadLineAnim.stopAnimation();
    loadLineAnim.setValue(0);
    setIsLoadLineComplete(false);

    Animated.timing(loadLineAnim, {
      toValue: 1,
      duration: 1600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setIsLoadLineComplete(true);
      }
    });
  }, [loadLineAnim]);

  const onLoadStart = useCallback(() => {
    setHasError(false);
    setIsPageLoaded(false);
    startLoadLine();
  }, [startLoadLine]);

  const onLoadEnd = useCallback(() => {
    setIsPageLoaded(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!canGoBackRef.current) {
          return false;
        }

        webViewRef.current?.goBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [pulseAnim]);

  useEffect(() => {
    startLoadLine();
  }, [startLoadLine]);

  const logoScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  const logoOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });

  const loadLineWidth = loadLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 170],
  });

  const showLoaderOverlay = !isPageLoaded || !isLoadLineComplete;

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.fallbackContainer}>
          <Animated.View
            style={[
              styles.logoCard,
              {
                transform: [{ scale: logoScale }],
                opacity: logoOpacity,
              },
            ]}
          >
            <SvgUri uri={LOGO_URL} width={170} height={80} />
            <View style={styles.logoUnderlineTrack}>
              <View style={styles.logoUnderlineStatic} />
            </View>
          </Animated.View>
          <Text style={styles.fallbackTitle}>Unable to load the website</Text>
          <Text style={styles.fallbackSubtitle}>
            Check your internet connection and try again.
          </Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={[styles.webview, showLoaderOverlay && styles.webviewHidden]}
        onError={onError}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      />

      {showLoaderOverlay && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <View style={styles.loaderContainer}>
            <Animated.View
              style={[
                styles.logoCard,
                {
                  transform: [{ scale: logoScale }],
                  opacity: logoOpacity,
                },
              ]}
            >
              <SvgUri uri={LOGO_URL} width={190} height={90} />
              <View style={styles.logoUnderlineTrack}>
                <Animated.View
                  style={[styles.logoUnderlineFill, { width: loadLineWidth }]}
                />
              </View>
            </Animated.View>
            <Text style={styles.loaderLabel}>
              Preparing fresh experience...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webview: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webviewHidden: {
    opacity: 0,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  loaderContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  logoCard: {
    width: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  logoUnderlineTrack: {
    marginTop: 8,
    width: 170,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#e8ece8",
    overflow: "hidden",
  },
  logoUnderlineFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#355945",
  },
  logoUnderlineStatic: {
    width: 170,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#355945",
  },
  loaderLabel: {
    fontSize: 14,
    color: "#355945",
    fontWeight: "600",
  },
  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
  },
  fallbackSubtitle: {
    fontSize: 15,
    color: "#444444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#111111",
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
