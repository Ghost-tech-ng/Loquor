// The Arena tab.
//
// The Arena is the product: the one drill whose numbers the rest of the app
// exists to move. It used to be card one of six under Practice, which made it
// look like an option. Now it has a tab of its own, and this screen is the
// doorway — the prompt waiting for you, and every take you have already made.
//
// The prompt is the same one Today shows, picked by the same function from the
// same history, so the two screens never disagree about what you should be
// talking about. Once you have done it, the history has moved on and so has
// the pick: the next prompt is simply the next unused one. Still no reroll —
// speaking on something you did not choose is the exercise.

import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { Button, Eyebrow, Hair, Masthead, Meta, Reveal, Screen, Tap } from "../../components/ui";
import { fillerStrain, strain } from "../../components/viz";
import { CHROME, RADIUS, SPACE, SURFACE, TABULAR, TYPE } from "../../theme";
import { TOPICS_BY_ID, pickTopic, type Topic } from "./topics";
import { countToday, recentSessions, usedTopicIds, type SessionRow } from "../../lib/db";
import { fillerCountIsApproximate, loadSettings, resolve } from "../../lib/settings";

const DOMAIN_LABEL: Record<Topic["domain"], string> = {
  field: "YOUR FIELD",
  random: "OFF YOUR FIELD",
};

export default function ArenaHome() {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [done, setDone] = useState(0);
  const [takes, setTakes] = useState<SessionRow[] | null>(null);
  const [approx, setApprox] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const [settings, used, today, rows] = await Promise.all([
          loadSettings(),
          usedTopicIds(),
          countToday(),
          recentSessions(20),
        ]);
        if (!live) return;
        const lastDomain = rows[0] ? TOPICS_BY_ID.get(rows[0].topic_id)?.domain : undefined;
        setTopic(pickTopic({ usedIds: used, lastDomain }));
        setDone(today);
        setTakes(rows);
        setApprox(fillerCountIsApproximate(resolve(settings).stt));
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const start = () => {
    if (topic) router.push({ pathname: "/arena", params: { topicId: topic.id } });
  };

  return (
    <Screen>
      <Masthead right="ARENA" setup />

      <Reveal index={0} style={s.intro}>
        <Text style={s.introTitle}>Ninety seconds on something you did not pick.</Text>
        <Text style={s.introBody}>
          Sixty seconds to gather it, ninety to talk. You get back your filler rate, your pace,
          where you stalled, and one line you should have said better.
        </Text>
      </Reveal>

      <Reveal index={1}>
        <View style={s.card}>
          <View style={s.cardHead}>
            <Eyebrow>{done > 0 ? "NEXT PROMPT" : "TODAY'S PROMPT"}</Eyebrow>
            {topic ? <Text style={s.domain}>{DOMAIN_LABEL[topic.domain]}</Text> : null}
          </View>
          <Text style={s.prompt}>{topic?.title ?? " "}</Text>
          <Button label={done > 0 ? "GO AGAIN" : "START"} onPress={start} disabled={!topic} />
          {done > 0 ? (
            <Meta>
              {done} {done === 1 ? "take" : "takes"} today. The second one is usually the one
              worth keeping.
            </Meta>
          ) : null}
        </View>
      </Reveal>

      <Hair style={{ marginTop: SPACE.sm }} />

      <View style={s.head}>
        <Eyebrow>YOUR TAKES</Eyebrow>
        {takes && takes.length > 0 ? <Text style={s.count}>{takes.length} LATEST</Text> : null}
      </View>

      {takes === null ? null : takes.length === 0 ? (
        <Meta>Nothing recorded yet. Each take lands here with its scorecard.</Meta>
      ) : (
        <View style={s.list}>
          {takes.map((r, i) => (
            <Reveal key={r.id} index={2 + Math.min(i, 8)}>
              <Tap
                onPress={() => router.push({ pathname: "/scorecard", params: { id: r.id } })}
                style={s.row}
              >
                <View style={[s.rowTick, { backgroundColor: strain(fillerStrain(r.filler_rate)) }]} />
                <View style={s.rowText}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {r.topic_title}
                  </Text>
                  <Text style={s.rowMeta}>
                    {new Date(r.started_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                    {"  ·  "}
                    {approx ? "≈" : ""}
                    {r.filler_rate.toFixed(1)}/min
                    {"  ·  "}
                    {r.wpm} wpm
                    {r.rubric_total !== null ? `  ·  ${r.rubric_total}/20` : ""}
                  </Text>
                </View>
              </Tap>
            </Reveal>
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { gap: 7 },
  introTitle: { color: CHROME.chalk, fontSize: 22, lineHeight: 28, fontFamily: TYPE.display },
  introBody: { color: CHROME.dust, fontSize: 13, lineHeight: 21, fontFamily: TYPE.ui },

  card: {
    backgroundColor: SURFACE.sunk,
    borderWidth: 1,
    borderColor: SURFACE.edgeLive,
    borderRadius: RADIUS.panel,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  domain: { color: CHROME.dustDim, fontSize: 9.5, fontFamily: TYPE.mono, letterSpacing: 1.2 },
  prompt: { color: CHROME.chalk, fontSize: 21, lineHeight: 28, fontFamily: TYPE.displayItalic },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  count: { color: CHROME.dustDim, fontSize: 9.5, fontFamily: TYPE.mono, ...TABULAR },
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowTick: { width: 3, alignSelf: "stretch", minHeight: 26 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: CHROME.chalk, fontSize: 14, fontFamily: TYPE.ui },
  rowMeta: { color: CHROME.dustDim, fontSize: 9.5, fontFamily: TYPE.mono, ...TABULAR },
});
