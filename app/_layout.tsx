import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

const BRAND_BEIGE = "#F3F0E9";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BRAND_BEIGE },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style="dark" backgroundColor={BRAND_BEIGE} />
    </>
  );
}
