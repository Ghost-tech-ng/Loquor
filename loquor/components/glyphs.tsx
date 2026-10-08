// Tab glyphs, drawn from Views.
//
// No icon library. Partly because adding one for five shapes is a dependency
// for nothing, and partly because every stock set carries someone else's
// drawing style — rounded strokes and friendly corners that would fight the
// squared, hairline chrome the rest of the app is built from (PRD §12).
//
// Each glyph is a 22×22 box on a 1px grid so they optically align in a row.
// None of them carry colour of their own: the bar passes `tint`, which is chalk
// when the tab is current and dust when it is not. Colour is data everywhere
// else in this app, and a navigation control is not data.

import { StyleSheet, View } from "react-native";

const BOX = 22;

type P = { tint: string };

/** Today — the aperture. The same ring the record button draws, at 1/5 scale. */
export function GlyphToday({ tint }: P) {
  return (
    <View style={s.box}>
      <View style={[s.ring, { borderColor: tint }]} />
      <View style={[s.core, { backgroundColor: tint }]} />
    </View>
  );
}

/** Arena — the clock you speak against: a dial with one hand, at the top. */
export function GlyphArena({ tint }: P) {
  return (
    <View style={s.box}>
      <View style={[s.dial, { borderColor: tint }]} />
      <View style={[s.crown, { backgroundColor: tint }]} />
      <View style={[s.hand, { backgroundColor: tint }]} />
    </View>
  );
}

/** Practice — a waveform. The drills are the only place you make one. */
export function GlyphPractice({ tint }: P) {
  const heights = [7, 14, 20, 11];
  return (
    <View style={[s.box, s.rowEnd]}>
      {heights.map((h, i) => (
        <View key={i} style={[s.bar, { height: h, backgroundColor: tint }]} />
      ))}
    </View>
  );
}

/** Rooms — a table seen from above, with a seat at the head. */
export function GlyphRooms({ tint }: P) {
  return (
    <View style={s.box}>
      <View style={[s.table, { borderColor: tint }]} />
      <View style={[s.seat, { backgroundColor: tint }]} />
    </View>
  );
}

/** Progress — the strata wall, which is what the screen actually shows. */
export function GlyphProgress({ tint }: P) {
  const heights = [8, 13, 10, 18];
  return (
    <View style={[s.box, s.rowEnd]}>
      {heights.map((h, i) => (
        <View key={i} style={[s.bar, { height: h, backgroundColor: tint }]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: "center", justifyContent: "center" },
  rowEnd: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3 },

  ring: { position: "absolute", width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  core: { width: 7, height: 7, borderRadius: 3.5 },

  dial: { position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  crown: { position: "absolute", top: 0, width: 5, height: 2, borderRadius: 1 },
  hand: { position: "absolute", top: 7, width: 1.5, height: 6, borderRadius: 0.75 },

  bar: { width: 2.5, borderRadius: 1.25 },

  table: { width: 20, height: 13, borderWidth: 1.5, borderRadius: 4 },
  seat: { position: "absolute", width: 5, height: 2.5, top: 1.5, borderRadius: 1 },
});
