import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

const DOTS = 3;
const STAGGER = 160;
const RISE = 420;

/** Three dots that rise, grow and brighten one after another while Arvo is thinking. */
export function TypingDots() {
  // Created once and kept for the life of the component.
  const [values] = useState(() => Array.from({ length: DOTS }, () => new Animated.Value(0)));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const easing = Easing.bezier(0.45, 0, 0.55, 1);
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER),
          Animated.timing(value, { toValue: 1, duration: RISE, easing, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: RISE, easing, useNativeDriver: true }),
          Animated.delay((DOTS - 1 - i) * STAGGER + 120),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values, reduceMotion]);

  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="Arvo is writing a reply">
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            reduceMotion
              ? { opacity: 0.8 }
              : {
                  opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  transform: [
                    { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
                    { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
                  ],
                },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 24, paddingVertical: 6, paddingHorizontal: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
