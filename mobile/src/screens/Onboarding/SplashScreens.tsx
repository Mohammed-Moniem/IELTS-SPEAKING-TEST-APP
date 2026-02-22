// SplashScreens.tsx
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeModeSwitch } from "../../components/ThemeModeSwitch";
import { useTheme } from "../../context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Spokio Brand Colors
const LIGHT_COLORS = {
  white: "#FFFFFF",
  purple100: "#F3E8FF",
  purple200: "#E9D5FF",
  purple300: "#D8B4FE",
  purple400: "#C084FC",
  purple500: "#A855F7",
  purple600: "#9333EA",
  purple700: "#7E22CE",
  purple900: "#581C87",
  brandPrimary: "#7C3AED",
  black: "#000000",
};

const DARK_COLORS = {
  white: "#0F0B1A",
  purple100: "#2D1F46",
  purple200: "#3A235A",
  purple300: "#4B2C72",
  purple400: "#6A3AA4",
  purple500: "#8B5CF6",
  purple600: "#A78BFA",
  purple700: "#C4B5FD",
  purple900: "#E0E7FF",
  brandPrimary: "#A855F7",
  black: "#FFFFFF",
};

type SplashPalette = typeof LIGHT_COLORS;

const useSplashPalette = (): SplashPalette => {
  const { theme } = useTheme();
  return theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
};

// Reusable Animated wrappers
const AView = Animated.createAnimatedComponent(View);
const AImage = Animated.createAnimatedComponent(Image);
const APressable = Animated.createAnimatedComponent(Pressable);

type AuthShortcutProps = {
  styles: ReturnType<typeof createStyles>;
  onSignIn?: () => void;
  onRegister?: () => void;
};

const AuthShortcutRow: React.FC<AuthShortcutProps> = ({
  styles,
  onSignIn,
  onRegister,
}) => {
  if (!onSignIn && !onRegister) {
    return null;
  }

  return (
    <View style={styles.authShortcutRow}>
      {onSignIn ? (
        <Pressable onPress={onSignIn}>
          <Text style={styles.authShortcutText}>Sign in</Text>
        </Pressable>
      ) : null}
      {onSignIn && onRegister ? <Text style={styles.authShortcutDot}>•</Text> : null}
      {onRegister ? (
        <Pressable onPress={onRegister}>
          <Text style={styles.authShortcutText}>Create account</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

// ---------- SplashScreen 1 ----------
export interface SplashScreen1Props {
  onNext: () => void;
  onSkip: () => void;
  logoSource?: ImageSourcePropType;
  onSignIn?: () => void;
  onRegister?: () => void;
}

export function SplashScreen1({
  onNext,
  onSkip,
  logoSource,
  onSignIn,
  onRegister,
}: SplashScreen1Props) {
  const palette = useSplashPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { theme } = useTheme();
  const statusBarStyle = theme === "dark" ? "light" : "dark";
  // Background circles
  const bg1Scale = useSharedValue(1);
  const bg1Opacity = useSharedValue(0.6);
  const bg2Scale = useSharedValue(1);
  const bg2Opacity = useSharedValue(0.5);

  // Logo entrance + bounce
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(-180);
  const logoBounceY = useSharedValue(0);

  // Sparkles
  const sp1Scale = useSharedValue(0);
  const sp1Opacity = useSharedValue(0);
  const sp2Scale = useSharedValue(0);
  const sp2Opacity = useSharedValue(0);

  // Text + Button entrances
  const h1Opacity = useSharedValue(0);
  const h1Y = useSharedValue(20);
  const pOpacity = useSharedValue(0);
  const pY = useSharedValue(20);
  const btnOpacity = useSharedValue(0);
  const btnScale = useSharedValue(0.8);

  useEffect(() => {
    // Pulsing blobs
    bg1Scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    bg1Opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.6, { duration: 1500 })
      ),
      -1
    );
    bg2Scale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.3, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );
    bg2Opacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 2000 }),
          withTiming(0.5, { duration: 2000 })
        ),
        -1
      )
    );

    // Logo entrance
    logoScale.value = withSpring(1, { stiffness: 200, damping: 20 });
    logoRotate.value = withTiming(0, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });

    // Logo bounce
    logoBounceY.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-10, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      )
    );

    // Sparkles pulsing
    const pulse = (
      scaleRef: SharedValue<number>,
      opRef: SharedValue<number>,
      delay = 0
    ) => {
      scaleRef.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 400 })
          ),
          -1
        )
      );
      opRef.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 400 })
          ),
          -1
        )
      );
    };
    pulse(sp1Scale, sp1Opacity, 1500);
    pulse(sp2Scale, sp2Opacity, 2000);

    // Text + Button
    h1Opacity.value = withDelay(800, withTiming(1, { duration: 800 }));
    h1Y.value = withDelay(800, withTiming(0, { duration: 800 }));
    pOpacity.value = withDelay(1200, withTiming(1, { duration: 800 }));
    pY.value = withDelay(1200, withTiming(0, { duration: 800 }));
    btnOpacity.value = withDelay(1600, withTiming(1, { duration: 500 }));
    btnScale.value = withDelay(1600, withTiming(1, { duration: 500 }));
  }, []);

  const bg1Style = useAnimatedStyle(() => ({
    transform: [{ scale: bg1Scale.value }],
    opacity: bg1Opacity.value,
  }));
  const bg2Style = useAnimatedStyle(() => ({
    transform: [{ scale: bg2Scale.value }],
    opacity: bg2Opacity.value,
  }));
  const logoWrapperStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoBounceY.value }],
  }));
  const sp1Style = useAnimatedStyle(() => ({
    opacity: sp1Opacity.value,
    transform: [{ scale: sp1Scale.value }],
  }));
  const sp2Style = useAnimatedStyle(() => ({
    opacity: sp2Opacity.value,
    transform: [{ scale: sp2Scale.value }],
  }));
  const h1Style = useAnimatedStyle(() => ({
    opacity: h1Opacity.value,
    transform: [{ translateY: h1Y.value }],
  }));
  const pStyle = useAnimatedStyle(() => ({
    opacity: pOpacity.value,
    transform: [{ translateY: pY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ scale: btnScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style={statusBarStyle}
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.screen}>
      <ThemeModeSwitch style={styles.themeSwitch} />

      {/* Skip Button */}
      <APressable onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="arrow-forward" size={16} color={palette.white} />
      </APressable>

      {/* Animated background circles */}
      <AView style={[styles.bgCircle1, bg1Style]} />
      <AView style={[styles.bgCircle2, bg2Style]} />

      {/* Logo animation */}
      <AView style={[styles.mb12, logoWrapperStyle]}>
        <View style={styles.logoCard}>
          <AImage
            source={logoSource ?? require("../../../assets/logo.png")}
            resizeMode="cover"
            style={[styles.logoImage, logoStyle]}
          />
        </View>
      </AView>

      {/* Sparkle icons */}
      <AView style={[styles.sparkle1, sp1Style]}>
        <Ionicons name="sparkles" size={24} color={palette.purple500} />
      </AView>
      <AView style={[styles.sparkle2, sp2Style]}>
        <Ionicons name="sparkles" size={20} color={palette.purple400} />
      </AView>

      {/* Text content */}
      <AView style={h1Style}>
        <Text style={[styles.h1, { color: palette.purple900 }]}>
          Welcome to Spokio
        </Text>
      </AView>

      <AView style={[styles.mb12, pStyle]}>
        <Text style={[styles.p, { color: palette.purple700 }]}>
          Raise your IELTS band faster with realistic speaking practice and
          clear feedback in minutes.
        </Text>
      </AView>

      {/* Next button */}
      <APressable onPress={onNext} style={[styles.btn, btnStyle]}>
        <Text style={styles.btnText}>Get Started</Text>
      </APressable>
      <AuthShortcutRow
        styles={styles}
        onSignIn={onSignIn}
        onRegister={onRegister}
      />
      </View>
    </SafeAreaView>
  );
}

// ---------- SplashScreen 2 ----------
export interface SplashScreen2Props {
  onNext: () => void;
  onSkip: () => void;
  onSignIn?: () => void;
  onRegister?: () => void;
}

export function SplashScreen2({
  onNext,
  onSkip,
  onSignIn,
  onRegister,
}: SplashScreen2Props) {
  const palette = useSplashPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { theme } = useTheme();
  const statusBarStyle = theme === "dark" ? "light" : "dark";
  // Orb scale/rotate
  const orbScale = useSharedValue(1);
  const orbRotate = useSharedValue(0);

  // Main text entrance
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(30);

  // Feature cards
  const card1Opacity = useSharedValue(0);
  const card1X = useSharedValue(-50);
  const card2Opacity = useSharedValue(0);
  const card2X = useSharedValue(-50);
  const card3Opacity = useSharedValue(0);
  const card3X = useSharedValue(-50);

  // Card icon pulses
  const icon1Scale = useSharedValue(1);
  const icon2Scale = useSharedValue(1);
  const icon3Scale = useSharedValue(1);

  // Button
  const btnOpacity = useSharedValue(0);
  const btnScale = useSharedValue(0.8);

  useEffect(() => {
    // Orb
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 4000, easing: Easing.linear }),
        withTiming(1, { duration: 4000, easing: Easing.linear })
      ),
      -1
    );
    orbRotate.value = withRepeat(
      withSequence(
        withTiming(90, { duration: 4000, easing: Easing.linear }),
        withTiming(0, { duration: 4000, easing: Easing.linear })
      ),
      -1
    );

    // Text
    titleOpacity.value = withTiming(1, { duration: 800 });
    titleY.value = withTiming(0, { duration: 800 });

    // Cards with delays
    const showCard = (op: any, x: any, delay: number) => {
      op.value = withDelay(delay, withTiming(1, { duration: 600 }));
      x.value = withDelay(delay, withTiming(0, { duration: 600 }));
    };
    showCard(card1Opacity, card1X, 200);
    showCard(card2Opacity, card2X, 400);
    showCard(card3Opacity, card3X, 600);

    // Icons pulse
    const pulse = (sv: any, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1.1, {
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
          ),
          -1
        )
      );
    };
    pulse(icon1Scale, 1200);
    pulse(icon2Scale, 1400);
    pulse(icon3Scale, 1600);

    // Button
    btnOpacity.value = withDelay(1000, withTiming(1, { duration: 500 }));
    btnScale.value = withDelay(1000, withTiming(1, { duration: 500 }));
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }, { rotate: `${orbRotate.value}deg` }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const c1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateX: card1X.value }],
  }));
  const c2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateX: card2X.value }],
  }));
  const c3Style = useAnimatedStyle(() => ({
    opacity: card3Opacity.value,
    transform: [{ translateX: card3X.value }],
  }));
  const i1 = useAnimatedStyle(() => ({
    transform: [{ scale: icon1Scale.value }],
  }));
  const i2 = useAnimatedStyle(() => ({
    transform: [{ scale: icon2Scale.value }],
  }));
  const i3 = useAnimatedStyle(() => ({
    transform: [{ scale: icon3Scale.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ scale: btnScale.value }],
  }));

  const FeatureCard = ({
    icon,
    text,
    style,
    iconStyle,
  }: {
    icon: string;
    text: string;
    style: any;
    iconStyle: any;
  }) => {
    return (
      <AView style={[styles.card, style]}>
        <AView style={[styles.cardIconWrap, iconStyle]}>
          <Ionicons name={icon as any} size={28} color={palette.purple600} />
        </AView>
        <Text style={[styles.cardText, { color: palette.purple900 }]}>
          {text}
        </Text>
      </AView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style={statusBarStyle}
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.screen}>
      <ThemeModeSwitch style={styles.themeSwitch} />

      {/* Skip Button */}
      <APressable onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="arrow-forward" size={16} color={palette.white} />
      </APressable>

      {/* Animated gradient orb */}
      <View style={StyleSheet.absoluteFillObject}>
        <AView style={[styles.orbCenter, { opacity: 1 }]}>
          <AView style={orbStyle}>
            <View
              style={[
                styles.orb,
                { backgroundColor: palette.purple400, opacity: 0.2 },
              ]}
            />
          </AView>
        </AView>
      </View>

      {/* Main content */}
      <AView style={[styles.center, styles.mb12, { zIndex: 10 }, titleStyle]}>
        <Text style={[styles.h2, { color: palette.purple900 }]}>
          AI-Powered Learning
        </Text>
        <Text
          style={[
            styles.p,
            { color: palette.purple700, textAlign: "center", opacity: 0.8 },
          ]}
        >
          See band-level feedback after every session and understand what to
          improve next.
        </Text>
      </AView>

      {/* Feature cards */}
      <View style={[styles.featuresWrap, { zIndex: 10 }]}>
        <FeatureCard
          icon="mic"
          text="Practice Speaking"
          style={c1Style}
          iconStyle={i1}
        />
        <FeatureCard
          icon="bulb"
          text="AI Feedback"
          style={c2Style}
          iconStyle={i2}
        />
        <FeatureCard
          icon="bar-chart"
          text="Track Progress"
          style={c3Style}
          iconStyle={i3}
        />
      </View>

      {/* Next button */}
      <APressable
        onPress={onNext}
        style={[styles.btn, { zIndex: 10 }, btnStyle]}
      >
        <Text style={styles.btnText}>Continue</Text>
      </APressable>
      <AuthShortcutRow
        styles={styles}
        onSignIn={onSignIn}
        onRegister={onRegister}
      />
      </View>
    </SafeAreaView>
  );
}

// ---------- SplashScreen 3 ----------
export interface SplashScreen3Props {
  onNext: () => void;
  onSkip: () => void;
  onSignIn?: () => void;
  onRegister?: () => void;
}

export function SplashScreen3({
  onNext,
  onSkip,
  onSignIn,
  onRegister,
}: SplashScreen3Props) {
  const palette = useSplashPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { theme } = useTheme();
  const statusBarStyle = theme === "dark" ? "light" : "dark";
  // Floating achievement icons (appear + bob)
  const appear1 = useSharedValue(0);
  const appear2 = useSharedValue(0);
  const appear3 = useSharedValue(0);
  const bob1 = useSharedValue(0);
  const bob2 = useSharedValue(0);
  const bob3 = useSharedValue(0);

  // Score circle ring
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(1);

  // CTA
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(20);

  // Particles
  const particles = useMemo(
    () =>
      new Array(6).fill(0).map((_, i) => ({
        key: i,
        startX: Math.random() * SCREEN_W * 0.9,
        startY: Math.random() * SCREEN_H * 0.9,
        endY: Math.random() * SCREEN_H * 0.9,
        delay: i * 300,
        duration: 3000 + Math.random() * 2000,
      })),
    []
  );
  const particleYs = particles.map(() => useSharedValue(0));
  const particleOpacities = particles.map(() => useSharedValue(0));

  useEffect(() => {
    // Appear animations
    const appear = (sv: any, delay: number) => {
      sv.value = withDelay(
        delay,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) })
      );
    };
    appear(appear1, 0);
    appear(appear2, 300);
    appear(appear3, 600);

    const bob = (sv: any, delay: number) => {
      sv.value = withDelay(
        delay + 1000,
        withRepeat(
          withSequence(
            withTiming(-15, {
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
          ),
          -1
        )
      );
    };
    bob(bob1, 0);
    bob(bob2, 300);
    bob(bob3, 600);

    // Ring pulse
    ringScale.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 2000 }),
          withTiming(1, { duration: 0 })
        ),
        -1,
        false
      )
    );
    ringOpacity.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 2000 }),
          withTiming(1, { duration: 0 })
        ),
        -1,
        false
      )
    );

    // CTA
    ctaOpacity.value = withDelay(1400, withTiming(1, { duration: 500 }));
    ctaY.value = withDelay(1400, withTiming(0, { duration: 500 }));

    // Particles loop
    particles.forEach((p, idx) => {
      const y = particleYs[idx];
      const o = particleOpacities[idx];
      y.value = p.startY;
      o.value = 0;
      y.value = withDelay(
        p.delay,
        withRepeat(
          withSequence(
            withTiming(p.endY, { duration: p.duration }),
            withTiming(p.startY, { duration: 0 })
          ),
          -1
        )
      );
      o.value = withDelay(
        p.delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: p.duration / 2 }),
            withTiming(0, { duration: p.duration / 2 })
          ),
          -1
        )
      );
    });
  }, []);

  const iconAppearStyle = (sv: SharedValue<number>, rotStart = -180) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [
        { scale: interpolate(sv.value, [0, 1], [0, 1]) },
        { rotate: `${interpolate(sv.value, [0, 1], [rotStart, 0])}deg` },
      ],
    }));

  const iconBobStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      transform: [{ translateY: sv.value }],
    }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaY.value }],
  }));

  const Particle = ({ idx }: { idx: number }) => {
    const style = useAnimatedStyle(() => ({
      position: "absolute",
      left: particles[idx].startX,
      top: particleYs[idx].value,
      opacity: particleOpacities[idx].value,
    }));
    return <AView style={[styles.particle, style]} />;
  };

  const FloatingIcon = ({
    iconName,
    appear,
    bob,
    position,
  }: {
    iconName: string;
    appear: SharedValue<number>;
    bob: SharedValue<number>;
    position: { top?: number; left?: number; right?: number; bottom?: number };
  }) => {
    const a = iconAppearStyle(appear);
    const b = iconBobStyle(bob);
    return (
      <AView style={[styles.floatingWrap, position, a]}>
        <AView style={[styles.floatingTile, b]}>
          <Ionicons name={iconName as any} size={32} color={palette.white} />
        </AView>
      </AView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style={statusBarStyle}
        backgroundColor="transparent"
        translucent
      />
      <View style={[styles.screen, { overflow: "hidden" }]}>
        <ThemeModeSwitch style={styles.themeSwitch} />

        {/* Skip Button */}
        <APressable onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="arrow-forward" size={16} color={palette.white} />
        </APressable>

        {/* Background particles */}
        {particles.map((p) => (
          <Particle key={p.key} idx={p.key} />
        ))}

        {/* Floating achievement icons */}
        <FloatingIcon
          iconName="trophy"
          appear={appear1}
          bob={bob1}
          position={{ top: SCREEN_H * 0.2, left: SCREEN_W * 0.15 }}
        />
        <FloatingIcon
          iconName="radio-button-on"
          appear={appear2}
          bob={bob2}
          position={{ top: SCREEN_H * 0.3, right: SCREEN_W * 0.2 }}
        />
        <FloatingIcon
          iconName="flash"
          appear={appear3}
          bob={bob3}
          position={{ bottom: SCREEN_H * 0.35, left: SCREEN_W * 0.2 }}
        />

        {/* Main content */}
        <View style={[styles.center, { zIndex: 10 }]}>
          <View style={styles.mb6}>
            <Text style={[styles.h2, { color: palette.purple900 }]}>
              Achieve Your Goals
            </Text>
            <Text
              style={[
                styles.p,
                { color: palette.purple700, textAlign: "center", opacity: 0.8 },
              ]}
            >
              Most learners see clearer speaking structure and stronger answers
              after a few guided sessions.
            </Text>
          </View>

          {/* Score animation */}
          <View
            style={[
              styles.mb12,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <View
              style={[
                styles.scoreBall,
                { backgroundColor: palette.brandPrimary },
              ]}
            >
              <Text
                style={{ color: palette.white, fontWeight: "600", fontSize: 16 }}
              >
                Band 9.0
              </Text>
            </View>

            {/* Ring */}
            <AView style={[styles.scoreRing, ringStyle]} />
          </View>

          {/* CTA button */}
          <APressable onPress={onNext} style={[styles.btnLg, ctaStyle]}>
            <Text style={styles.btnText}>Start Learning</Text>
          </APressable>
          <AuthShortcutRow
            styles={styles}
            onSignIn={onSignIn}
            onRegister={onRegister}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const createStyles = (palette: SplashPalette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.white,
  },
  screen: {
    flex: 1,
    width: "100%",
    height: "100%",
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.white,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  bgCircle1: {
    position: "absolute",
    top: 80,
    right: 40,
    width: 128,
    height: 128,
    backgroundColor: palette.purple200,
    borderRadius: 999,
    opacity: 0.6,
  },
  bgCircle2: {
    position: "absolute",
    bottom: 128,
    left: 40,
    width: 160,
    height: 160,
    backgroundColor: palette.purple300,
    borderRadius: 999,
    opacity: 0.5,
  },
  sparkle1: {
    position: "absolute",
    top: SCREEN_H * 0.33,
    left: SCREEN_W * 0.25,
  },
  sparkle2: {
    position: "absolute",
    top: SCREEN_H * 0.5,
    right: SCREEN_W * 0.25,
  },
  h1: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  p: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 420,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: palette.purple600,
    borderRadius: 999,
  },
  btnLg: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    backgroundColor: palette.purple600,
    borderRadius: 999,
    shadowColor: palette.black,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 6,
  },
  btnText: {
    color: palette.white,
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  mb12: { marginBottom: 48 },
  mb6: { marginBottom: 24 },
  orbCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    width: 384,
    height: 384,
    borderRadius: 999,
    opacity: 0.2,
  },
  featuresWrap: {
    marginBottom: 48,
    gap: 16,
    width: "100%",
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 24,
    padding: 24,
    width: 320,
    shadowColor: palette.black,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.purple100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    fontSize: 16,
    fontWeight: "600",
  },
  particle: {
    width: 8,
    height: 8,
    backgroundColor: palette.purple400,
    borderRadius: 4,
  },
  floatingWrap: {
    position: "absolute",
  },
  floatingTile: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.purple600,
    shadowColor: palette.black,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 6,
  },
  scoreBall: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.purple600,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 30,
    elevation: 10,
  },
  scoreRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: palette.purple300,
  },
  skipButton: {
    position: "absolute",
    top: 50,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: palette.purple600,
    zIndex: 100,
    shadowColor: palette.black,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  themeSwitch: {
    position: "absolute",
    top: 50,
    left: 24,
    zIndex: 100,
  },
  skipText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "600",
  },
  logoCard: {
    width: 140,
    height: 140,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: palette.white,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  authShortcutRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  authShortcutText: {
    color: palette.purple700,
    fontSize: 14,
    fontWeight: "600",
  },
  authShortcutDot: {
    color: palette.purple500,
    fontSize: 14,
    fontWeight: "700",
  },
  });
