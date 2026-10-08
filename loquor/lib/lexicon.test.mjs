// node --test lib/lexicon.test.mjs  (run via: npm test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { countHedges, isFiller } from "./lexicon.ts";

test("an overlapping phrase counts once", () => {
  assert.equal(countHedges("I feel like we should ship it"), 1);
  assert.equal(countHedges("I think, I mean, it's sort of fine"), 3);
});

test("like as a verb or a comparison is not a hedge", () => {
  assert.equal(countHedges("I would like to walk through it"), 0);
  assert.equal(countHedges("I’d like to start"), 0);
  assert.equal(countHedges("it looks like a cache miss"), 0);
  assert.equal(countHedges("we like Postgres for this"), 0);
});

test("like as a tic still counts", () => {
  assert.equal(countHedges("it was, like, really slow"), 1);
  assert.equal(countHedges("so like the queue backs up"), 1);
});

test("just inside a compound is not a hedge", () => {
  assert.equal(countHedges("a just-in-time compiler"), 0);
  assert.equal(countHedges("we just restart it"), 1);
});

test("kind of as a noun phrase is not a hedge", () => {
  assert.equal(countHedges("what kind of index is it"), 0);
  assert.equal(countHedges("it's kind of slow"), 1);
});

test("a question about knowing is not a hedge", () => {
  assert.equal(countHedges("do you know the answer"), 0);
  assert.equal(countHedges("it's, you know, cached"), 1);
});

test("the old regex double count is gone", () => {
  // Was 3: "like" in "would like", "like" in "looks like", "just" in "just-in-time".
  assert.equal(countHedges("I would like to say it looks like a just-in-time design"), 0);
});

test("fillers match whole tokens only", () => {
  assert.equal(isFiller("Um,"), true);
  assert.equal(isFiller("umbrella"), false);
});
