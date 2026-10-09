// Record here, send there.
//
// The take people actually care about is the voice note to a boss, a client or
// a friend, not the practice prompt. This records one, reads it back in a
// sentence (fillers, pace, dead air), and hands the audio to the share sheet so
// it goes out through WhatsApp, iMessage or anywhere else. Nothing is saved: the
// file is deleted on re-record, on done, and when the screen goes away.

import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";

import { Aperture } from "../../components/kit/Recorder";
import { Glass } from "../../components/kit/Glass";
import { GlowButton } from "../../components/kit/GlowButton";
import { Masthead, Screen } from "../../components/kit/Screen";
import { Display, Meta } from "../../components/kit/Text";
import { VoiceOrb } from "../../components/kit/VoiceOrb";
import { discardAudio, useTake, type Take } from "../../components/useTake";
import { FILLER_TARGET_PER_MIN, PACE_BAND_WPM } from "../../lib/metrics";
import { AURORA, CHROME, SEMANTIC, SPACE, TABULAR, TYPE } from "../../theme";

/** A voice note that runs past this is a meeting. The clock turns red, nothing stops. */
const CEILING_S = 120;

type Stage = "ready" | "recording" | "checking" | "done";

function verdict(t: Take): string {
  const m = t.metrics;
  const fillers = m.fillerCount === 0 ? "No fillers" : `${m.fillerCount} filler${m.fillerCount === 1 ? "" : "s"}`;
  if (m.deadAirCount > 0) return `${fillers}, but ${m.deadAirCount === 1 ? "one long pause" : `${m.deadAirCount} long pauses`}. Worth another go?`;
  if (m.wpm > PACE_BAND_WPM.high) return `${fillers}. A little fast; they may replay it.`;
  if (m.fillerRate > FILLER_TARGET_PER_MIN) return `${fillers}. They will hear them. Another go?`;
  return `${fillers}. Good to send.`;
}

export default function VoiceNoteScreen() {
  const router = useRouter();
  const take = useTake({ keepAudio: true });
  const [stage, setStage] = useState<Stage>("ready");
  const [result, setResult] = useState<Take | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const uri = useRef<string | null>(null);

  useEffect(
    () => () => {
      discardAudio(uri.current);
    },
    []
  );

  const drop = () => {
    discardAudio(uri.current);
    uri.current = null;
    setResult(null);
  };

  const record = async () => {
    drop();
    setSendError(null);
    if (await take.start()) setStage("recording");
  };

  const finish = async () => {
    setStage("checking");
    const t = await take.stop();
    if (!t) {
      setStage("ready");
      return;
    }
    uri.current = t.audioUri;
    setResult(t);
    setStage("done");
  };

  const send = async () => {
    if (!uri.current) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setSendError("Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(uri.current, {
        mimeType: "audio/m4a",
        UTI: "public.mpeg-4-audio",
        dialogTitle: "Send voice note",
      });
    } catch {
      setSendError("Couldn't open the share sheet. Try again.");
    }
  };

  const close = () => {
    void take.cancel();
    drop();
  };

  if (stage === "recording") {
    return (
      <Screen scroll={false}>
        <Masthead close onClose={close} right="Voice note" />
        <Aperture level={take.level} seconds={take.seconds} ceilingS={CEILING_S} onStop={() => void finish()} />
      </Screen>
    );
  }

  if (stage === "checking") {
    return (
      <Screen scroll={false}>
        <Masthead right="Voice note" />
        <View style={s.center}>
          <VoiceOrb size={96} />
          <Meta style={s.centerText}>Listening back for fillers and pauses…</Meta>
        </View>
      </Screen>
    );
  }

  if (stage === "done" && result) {
    const m = result.metrics;
    return (
      <Screen>
        <Masthead close onClose={close} right="Voice note" />
        <Glass glow={m.fillerRate > FILLER_TARGET_PER_MIN || m.deadAirCount > 0 ? AURORA.coral : AURORA.mint} style={{ gap: SPACE.sm }}>
          <Display style={s.verdict}>{verdict(result)}</Display>
          <Text style={s.stats}>
            {Math.round(m.durationS)}s · {m.wpm} wpm · {m.fillerRate.toFixed(1)} fillers/min
          </Text>
          {result.text ? (
            <Text style={s.transcript} numberOfLines={6}>
              {result.text}
            </Text>
          ) : null}
        </Glass>
        <GlowButton label="Send as a voice note" icon="sparkles" onPress={() => void send()} />
        {sendError ? <Text style={s.error}>{sendError}</Text> : null}
        <GlowButton label="Record again" icon="replay" tone="ghost" onPress={() => void record()} />
        <GlowButton
          label="Done"
          tone="quiet"
          onPress={() => {
            drop();
            router.back();
          }}
        />
        <Meta>The audio stays on your phone until you send it, and is deleted when you leave.</Meta>
      </Screen>
    );
  }

  return (
    <Screen>
      <Masthead close onClose={close} right="Voice note" />
      <View style={s.intro}>
        <VoiceOrb size={140} mood="happy" />
        <Display style={s.title}>Say it here first.</Display>
        <Meta style={s.centerText}>
          Record the voice note you were about to send. We'll count the ums and long pauses, then you send it from here.
        </Meta>
      </View>
      {take.error ? <Text style={s.error}>{take.error}</Text> : null}
      <GlowButton
        label="Record"
        icon="mic"
        onPress={() => void record()}
        disabled={!take.ready}
      />
      {!take.ready ? <Meta style={s.centerText}>Waiting for the microphone…</Meta> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.md },
  centerText: { textAlign: "center", alignSelf: "center", maxWidth: 300 },
  intro: { alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.lg },
  title: { fontSize: 30, lineHeight: 36, textAlign: "center" },
  verdict: { fontSize: 24, lineHeight: 31 },
  stats: { color: CHROME.dust, fontSize: 12.5, fontFamily: TYPE.mono, ...TABULAR },
  transcript: { color: CHROME.dustDim, fontSize: 15, lineHeight: 23, fontFamily: TYPE.passage },
  error: { color: SEMANTIC.flaw, fontSize: 13.5, fontFamily: TYPE.uiMedium, textAlign: "center" },
});
