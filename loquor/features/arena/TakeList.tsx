// Your Arena takes, newest first, each opening its scorecard.
//
// It lived on the Arena tab. The Arena is now started from Home's one button,
// so the history moved to You, next to the rest of the record. Five rows by
// default: the list is for finding last week's take, not for scrolling.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { fillerStrain, strain } from "../../components/kit/Charts";
import { Meta } from "../../components/kit/Text";
import { PressableScale, Tap } from "../../components/kit/motion";
import { CHROME, RADIUS, SURFACE, TABULAR, TYPE } from "../../theme";
import { recentSessions, type SessionRow } from "../../lib/db";
import { fillerCountIsApproximate, loadSettings, resolve } from "../../lib/settings";

const SHORT = 5;

export function TakeList() {
  const router = useRouter();
  const [takes, setTakes] = useState<SessionRow[] | null>(null);
  const [approx, setApprox] = useState(true);
  const [all, setAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([loadSettings(), recentSessions(20)])
        .then(([settings, rows]) => {
          if (!live) return;
          setTakes(rows);
          setApprox(fillerCountIsApproximate(resolve(settings).stt));
        })
        .catch(() => {
          if (live) setTakes([]);
        });
      return () => {
        live = false;
      };
    }, [])
  );

  if (takes === null) return null;
  if (takes.length === 0) {
    return <Meta>Nothing recorded yet. Each Arena take lands here with its scorecard.</Meta>;
  }

  const shown = all ? takes : takes.slice(0, SHORT);

  return (
    <View style={s.list}>
      {shown.map((r) => (
        <Tap
          key={r.id}
          onPress={() => router.push({ pathname: "/scorecard", params: { id: r.id } })}
          style={s.row}
        >
          <View style={[s.tick, { backgroundColor: strain(fillerStrain(r.filler_rate)) }]} />
          <View style={s.text}>
            <Text style={s.title} numberOfLines={1}>
              {r.topic_title}
            </Text>
            <Text style={s.meta}>
              {new Date(r.started_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              {"  ·  "}
              {approx ? "≈" : ""}
              {r.filler_rate.toFixed(1)}/min
              {"  ·  "}
              {r.wpm} wpm
              {r.rubric_total !== null ? `  ·  ${r.rubric_total}/20` : ""}
            </Text>
          </View>
        </Tap>
      ))}
      {takes.length > SHORT ? (
        <PressableScale onPress={() => setAll((v) => !v)} style={s.more}>
          <Text style={s.moreText}>{all ? "Show fewer" : `Show all ${takes.length}`}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  tick: { width: 3, alignSelf: "stretch", minHeight: 26, borderRadius: 2 },
  text: { flex: 1, gap: 3 },
  title: { color: CHROME.chalk, fontSize: 14.5, fontFamily: TYPE.ui },
  meta: { color: CHROME.dustDim, fontSize: 11, fontFamily: TYPE.mono, ...TABULAR },
  more: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edge,
  },
  moreText: { color: CHROME.chalk, fontSize: 12.5, fontFamily: TYPE.uiSemi },
});
