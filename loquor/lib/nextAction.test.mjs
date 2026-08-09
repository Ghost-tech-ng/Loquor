import { test } from "node:test";
import assert from "node:assert/strict";

import { nextAction } from "./nextAction.ts";

/** A user with nothing outstanding — every rule below the last one passes. */
const clear = {
  hasKey: true,
  hasBaseline: true,
  dueDebriefs: 0,
  takesToday: 2,
  lexDue: 0,
  sectionsLeft: 0,
  roomsLogged: 4,
  roomsUpcoming: 1,
  sessionsEver: 20,
};

const at = (over) => nextAction({ ...clear, ...over });

test("a missing key outranks everything, including an expiring debrief", () => {
  const a = at({ hasKey: false, hasBaseline: false, dueDebriefs: 3 });
  assert.equal(a.id, "key");
  assert.equal(a.route, "/settings");
  assert.equal(a.urgent, true);
});

test("the baseline comes before any practice", () => {
  const a = at({ hasBaseline: false, takesToday: 0, lexDue: 9 });
  assert.equal(a.id, "baseline");
  assert.equal(a.route, "/onboarding");
});

test("a waiting debrief outranks today's take", () => {
  assert.equal(at({ dueDebriefs: 1, takesToday: 0 }).id, "debrief");
});

test("debrief copy is singular for one and plural beyond", () => {
  assert.match(at({ dueDebriefs: 1 }).title, /the meeting/);
  assert.match(at({ dueDebriefs: 2 }).title, /2 meetings/);
});

test("a brand-new user is sent to the Arena, not to a menu", () => {
  const a = at({ sessionsEver: 0, takesToday: 0, lexDue: 12, sectionsLeft: 6, roomsLogged: 0, roomsUpcoming: 0 });
  assert.equal(a.id, "first");
  assert.equal(a.route, "/arena");
});

test("only blocking or expiring actions are marked urgent", () => {
  for (const over of [{ hasKey: false }, { hasBaseline: false }, { dueDebriefs: 1 }]) {
    assert.equal(at(over).urgent, true, JSON.stringify(over));
  }
  for (const over of [{ sessionsEver: 0 }, { takesToday: 0 }, { lexDue: 5 }, { sectionsLeft: 2 }, {}]) {
    assert.equal(at(over).urgent, false, JSON.stringify(over));
  }
});

test("Rooms is raised once there is a habit but still no real meeting", () => {
  const a = at({ roomsLogged: 0, roomsUpcoming: 0, sessionsEver: 3, lexDue: 4 });
  assert.equal(a.id, "room");
});

test("Rooms is not nagged before the habit exists, nor when one is on the books", () => {
  assert.notEqual(at({ roomsLogged: 0, roomsUpcoming: 0, sessionsEver: 2, takesToday: 1 }).id, "room");
  assert.notEqual(at({ roomsLogged: 0, roomsUpcoming: 1, sessionsEver: 9 }).id, "room");
});

test("today's take outranks review, and review outranks the reading", () => {
  assert.equal(at({ takesToday: 0, lexDue: 5, sectionsLeft: 3 }).id, "today");
  assert.equal(at({ lexDue: 5, sectionsLeft: 3 }).id, "lexicon");
  assert.equal(at({ sectionsLeft: 3 }).id, "reading");
});

test("word count is singular at one", () => {
  assert.match(at({ lexDue: 1 }).title, /^1 word to review$/);
  assert.match(at({ lexDue: 7 }).title, /^7 words to review$/);
});

test("a fully clear user gets an offer, never an invented obligation", () => {
  const a = at({});
  assert.equal(a.id, "playbook");
  assert.equal(a.urgent, false);
  assert.match(a.eyebrow, /NOTHING OUTSTANDING/);
});

test("every branch returns a usable, non-empty action", () => {
  const overrides = [
    { hasKey: false },
    { hasBaseline: false },
    { dueDebriefs: 2 },
    { sessionsEver: 0 },
    { takesToday: 0 },
    { roomsLogged: 0, roomsUpcoming: 0, sessionsEver: 5 },
    { lexDue: 3 },
    { sectionsLeft: 1 },
    {},
  ];
  const seen = new Set();
  for (const over of overrides) {
    const a = at(over);
    for (const field of ["id", "eyebrow", "title", "why", "cta", "route"]) {
      assert.ok(a[field].length > 0, `${a.id}.${field} empty`);
    }
    assert.ok(a.route.startsWith("/"), `${a.id} route is not a path`);
    seen.add(a.id);
  }
  assert.equal(seen.size, overrides.length, "two overrides collapsed to the same rung");
});
