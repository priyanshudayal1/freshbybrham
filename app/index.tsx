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
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const startFresh = useCallback(() => {
    canGoBackRef.current = false;
    setIsLoading(true);
    setHasError(false);
    setReloadKey((current) => current + 1);
  }, []);

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

  const onError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const onLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);

  const onLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

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

    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulse.start();
    shimmer.start();

    return () => {
      pulse.stop();
      shimmer.stop();
    };
  }, [pulseAnim, shimmerAnim]);

  const logoScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  const logoOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  if (hasError) {
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
            <View style={styles.logoUnderlineTrack}>
              <Animated.View
                style={[
                  styles.logoUnderlineShimmer,
                  {
                    transform: [{ translateX: shimmerTranslateX }],
                  },
                ]}
              />
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.webviewContainer}>
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: APP_URL }}
          style={styles.webview}
          onError={onError}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        />

        {isLoading && !hasError ? (
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
                <SvgUri uri={LOGO_URL} width={190} height={90} />
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
              <ActivityIndicator size="small" color="#355945" />
              <Text style={styles.loaderLabel}>
                Preparing fresh experience...
              </Text>
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
    backgroundColor: "#ffffff",
  },
  webview: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webviewContainer: {
    flex: 1,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  loaderContainer: {
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
  logoUnderlineShimmer: {
    width: 64,
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
