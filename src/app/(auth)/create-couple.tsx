import {
  Body,
  Button,
  DatePickerField,
  Handwritten,
  Icon3D,
  PressableScale,
  ScreenBackground,
  successHaptic,
  Ticket,
  Title,
  toDateString,
  WashiTape,
} from "@/components/ui";
import { colors, ENTRANCE_DURATION, radius, space, type as typeScale } from "@/theme";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { createCouple } from "../../lib/couples";

export default function CreateCouple() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!startDate) {
      Alert.alert("Missing date", "Pick the day it all started.");
      return;
    }
    setBusy(true);
    try {
      const couple = await createCouple(toDateString(startDate));
      setInviteCode(couple.invite_code);
    } catch (err: any) {
      Alert.alert("Something went wrong", err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    successHaptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (inviteCode) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <Title variant="titleItalic" center>
            Your world is ready.
          </Title>
          <Body center color={colors.inkSoft} style={styles.lead}>
            Send this to your person so they can join you.
          </Body>

          {/* Key moment: the ticket slides in (Reanimated skips it under Reduce Motion). */}
          <Animated.View entering={FadeInDown.duration(ENTRANCE_DURATION)} style={styles.ticketWrap}>
            <WashiTape color="coral" rotate={-6} style={styles.tape} />
            <Ticket
              stub={
                <PressableScale
                  onPress={copyCode}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite code"
                  style={styles.copy}
                >
                  <Icon3D name={copied ? "sparkles" : "envelope"} size={24} />
                  <Text style={[typeScale.button, styles.copyText]}>
                    {copied ? "Copied" : "Copy code"}
                  </Text>
                </PressableScale>
              }
            >
              <Handwritten variant="handSmall" color={colors.inkSoft}>
                admit two
              </Handwritten>
              <Text selectable style={styles.code} accessibilityLabel={`Invite code ${inviteCode}`}>
                {inviteCode}
              </Text>
            </Ticket>
          </Animated.View>

          <Button title="Continue" onPress={() => router.replace("/")} style={styles.continue} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={styles.center}>
        <Icon3D name="calendar" size={80} style={styles.icon} />
        <Title variant="titleItalic" center>
          When did it start?
        </Title>
        <Body center color={colors.inkSoft} style={styles.lead}>
          The day you two became you two.
        </Body>

        <View style={styles.form}>
          <DatePickerField
            label="Together since"
            value={startDate}
            onChange={setStartDate}
            placeholder="Pick the day"
          />
          <Button title="Start our world" onPress={handleCreate} loading={busy} />
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  icon: { alignSelf: "center", marginBottom: space.lg },
  lead: { marginTop: space.sm },
  form: { marginTop: space.xxl },
  ticketWrap: { marginTop: space.xxl, transform: [{ rotate: "-1.5deg" }] },
  tape: { position: "absolute", top: -10, left: space.xl, zIndex: 1 },
  code: {
    ...typeScale.display,
    fontSize: 32,
    lineHeight: 40,
    color: colors.inkOcean,
    marginTop: space.xs,
    letterSpacing: 1,
  },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
  },
  copyText: { color: colors.inkOcean },
  continue: { marginTop: space.xxl },
});
