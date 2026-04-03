import * as NavigationBar from "expo-navigation-bar";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
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
const BRAND_BEIGE = "#F3F0E9";

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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(true);
  const [errorType, setErrorType] = useState<"offline" | "generic" | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);

  const clearLoadTimeout = useCallback(() => {
    if (!loadTimeoutRef.current) {
      return;
    }

    clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = null;
  }, []);

  const startFresh = useCallback(() => {
    clearLoadTimeout();
    canGoBackRef.current = false;
    setIsLoading(true);
    setErrorType(null);
    setReloadKey((current) => current + 1);
  }, [clearLoadTimeout]);

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
    startFresh();
  }, [startFresh]);

  const onError = useCallback(
    (event?: { nativeEvent?: { description?: string } }) => {
      const description =
        event?.nativeEvent?.description?.toLowerCase().trim() ?? "";
      const isOfflineError =
        description.includes("internet") ||
        description.includes("network") ||
        description.includes("offline") ||
        description.includes("timed out") ||
        description.includes("unreachable");

      clearLoadTimeout();
      setIsLoading(false);
      setErrorType(isOfflineError ? "offline" : "generic");
    },
    [clearLoadTimeout],
  );

  const onLoadStart = useCallback(() => {
    clearLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setErrorType("offline");
    }, 12000);

    setIsLoading(true);
    setErrorType(null);
  }, [clearLoadTimeout]);

  const onLoadEnd = useCallback(() => {
    clearLoadTimeout();
    setIsLoading(false);
  }, [clearLoadTimeout]);

  useFocusEffect(
    useCallback(() => {
      startFresh();
    }, [startFresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        startFresh();
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [startFresh]);

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
    if (Platform.OS !== "android") {
      return;
    }

    NavigationBar.setVisibilityAsync("hidden").catch(() => {
      // Non-fatal: if not available, keep default system behavior.
    });
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

  useEffect(
    () => () => {
      clearLoadTimeout();
    },
    [clearLoadTimeout],
  );

  const logoScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  const logoOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });

  if (errorType) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
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
          </Animated.View>
          <Text style={styles.fallbackTitle}>
            {errorType === "offline"
              ? "No internet connection"
              : "Unable to load the website"}
          </Text>
          <Text style={styles.fallbackSubtitle}>
            {errorType === "offline"
              ? "Please check your connection and try again."
              : "Something went wrong while opening Fresh by Brham. Please try again."}
          </Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.webviewContainer}>
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: APP_URL }}
          style={styles.webview}
          onError={onError}
          onHttpError={onError}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        />

        {isLoading && !errorType ? (
          <View style={styles.loaderOverlay}>
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
                <SvgUri uri={LOGO_URL} width={240} height={110} />
                {/* <View style={styles.logoUnderlineTrack}>
                  <Animated.View
                    style={[
                      styles.logoUnderlineShimmer,
                      {
                        transform: [{ translateX: shimmerTranslateX }],
                      },
                    ]}
                  />
                </View> */}
              </Animated.View>
              <ActivityIndicator size="large" color="#355945" />
              <Text style={styles.loaderLabel}>Loading Fresh by Brham...</Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_BEIGE,
  },
  webview: {
    flex: 1,
    backgroundColor: BRAND_BEIGE,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: BRAND_BEIGE,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_BEIGE,
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 18,
  },
  logoCard: {
    width: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: BRAND_BEIGE,
  },
  loaderLabel: {
    fontSize: 16,
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
