// Playbook scenarios. PRD §5 Pillar 2 — the drill material.
//
// Each one is a slice of a meeting, written the way people actually talk: they
// interrupt, they trail off, they say "kind of" and "basically", and somebody
// states a number with more confidence than it deserves. Clean prose would train
// the wrong thing. The skill is hearing the opening in a messy room.
//
// `fits` names the archetypes that genuinely apply at that moment. It is never
// shown before the answer — the whole drill is that you notice the opening
// yourself — and it is not a marking scheme either. The judge is told what fits
// and told explicitly that a well-aimed question outside the list still scores.
// The list exists so the judge has a floor, not a ceiling.
//
// `trap` is the obvious move that is wrong here, and every scenario has one,
// because the failure this trains against is not silence — it is the plausible
// question that makes the asker look like they were waiting to talk.
//
// Half the scenarios are outside software on purpose. A question shape that only
// works in a design review is not a question shape, it is a phrase.

export type Scenario = {
  id: string;
  /** Room, people, and how far in — the drill needs the timing, not just the topic. */
  setting: string;
  domain: "field" | "random";
  transcript: string;
  fits: string[];
  trap: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "s01",
    setting: "Design review, six people, twenty minutes in. You have not spoken.",
    domain: "field",
    transcript:
      "So the plan is we move the events table off Postgres onto DynamoDB. The write volume is going to be a problem by Q3 — we're at about forty thousand a minute now and it's roughly doubling every quarter. Dynamo handles that without us thinking about it. Migration's maybe three weeks, we dual-write for a bit, then cut over. I've got the schema sketched out already. Honestly the main risk is just the migration window itself, everything after that is straightforward.",
    fits: ["reversibility", "evidence-source", "second-order", "assumption-probe"],
    trap: "Asking whether Dynamo is really faster than Postgres. It is a benchmark argument, it will not resolve in the meeting, and it lets the room ignore that nobody has priced the one-way door.",
  },
  {
    id: "s02",
    setting: "Weekly planning, your manager and four engineers, near the end.",
    domain: "field",
    transcript:
      "Right, so for next quarter we've got the auth rewrite, the observability work, the SDK for the partner integration, and we still owe finance that reporting endpoint. All four are committed. I think if everyone picks one up we're fine — they're roughly the same size, maybe two to three weeks each. Let's just get them all moving Monday and we'll see where we are at the midpoint.",
    fits: ["sequencing", "load-bearing", "decision-owner", "cost-of-delay"],
    trap: "Asking whether the estimates are realistic. Everyone already knows they aren't, saying so adds nothing, and the actual problem is that four parallel streams have no order.",
  },
  {
    id: "s03",
    setting: "Incident review, twelve people on the call, day after the outage.",
    domain: "field",
    transcript:
      "Okay so root cause was the config push. Someone changed the connection pool size from fifty to five hundred, that exhausted the database, everything fell over for about forty minutes. Um, timeline — change went out at two, first alert was two thirty-one, we had someone looking at it by two forty and rolled back at two fifty-two. Fix is we're adding a review requirement on that config file. Two approvers instead of one. I've also asked the team to, you know, be more careful with pool settings generally, and we'll do a refresher on the runbook. I think that closes it out — anyone got anything else?",
    fits: ["silent-failure", "level-shift", "blast-radius", "falsifier"],
    trap: "Asking who made the change. It is the first question everyone wants to ask, it is never the useful one, and asking it publicly makes the next person hide their mistake for longer.",
  },
  {
    id: "s04",
    setting: "Architecture sync, staff engineer presenting, you are the most junior person there.",
    domain: "field",
    transcript:
      "The direction I'd like us to take is event-driven across the board. Every service publishes, every service subscribes, nothing calls anything directly. It's how Netflix does it, it's how Uber does it, and it means teams stop blocking each other on synchronous dependencies. Right now a change to checkout needs sign-off from three teams because they all call it directly, and that's, uh, that's the thing that's actually slowing us down. We'd start with the payments boundary since that's the most painful one right now, then work outward over the next couple of quarters.",
    fits: ["analogy-test", "failure-mode", "smallest-test", "tradeoff-surfacer"],
    trap: "Pointing out that you are not Netflix. It is true, it is the reflex, and it is heard as a cheap shot — the useful version names the specific thing that differs.",
  },
  {
    id: "s05",
    setting: "Model review, two ML engineers and a product manager, ten minutes in.",
    domain: "field",
    transcript:
      "New model's at ninety-four percent accuracy, up from eighty-nine. That's a big jump. We tuned the retrieval step and added the reranker, and honestly the reranker is doing most of it — we ablated it and without it we're back down to about ninety. Latency went up a bit, maybe eighty milliseconds at the median, which I don't think anyone will notice. I'd say we ship it this week. The eval set is the same one we've been using since March so it's a fair comparison, and product's been asking for this since the last quarterly.",
    fits: ["mechanism-ask", "evidence-source", "silent-failure", "unit-of-analysis"],
    trap: "Asking for more metrics. Precision, recall, F1 — you will get a list and learn nothing, because the interesting thing is that the eval set has not moved since March.",
  },
  {
    id: "s06",
    setting: "Vendor call, your team plus two sales engineers, thirty minutes in.",
    domain: "field",
    transcript:
      "What you get out of the box is a seventy percent reduction in time-to-detection. That's across our customer base. Most teams are up and running inside a week — the agent installs itself, discovers your services, and starts baselining immediately, no instrumentation work on your side at all. After about fourteen days of learning you're getting anomaly alerts with very low false-positive rates. One of our logistics customers went from, I think it was four hours mean time to detect down to under thirty minutes, and that was in the first quarter. Happy to put you in touch with them.",
    fits: ["evidence-source", "mechanism-ask", "scope-narrow", "silent-failure"],
    trap: "Asking about pricing. It is the question that feels hard-nosed and it is the one they have the best answer to. Every number in what they just said is unsourced.",
  },
  {
    id: "s07",
    setting: "Hiring debrief, four interviewers, deciding on a candidate.",
    domain: "field",
    transcript:
      "I'd lean no. She was fine on the coding round, got to a working solution, but she didn't ask any questions about the requirements before starting. Just went straight in. And in the system design she kept going back to things she'd built before rather than the problem I gave her. I don't know, something about it felt junior to me.",
    fits: ["definition-check", "scope-narrow", "falsifier", "invite-the-quiet"],
    trap: "Defending the candidate directly. You were not in that room; the useful move is on the word 'junior', which is doing all the work and has not been defined.",
  },
  {
    id: "s08",
    setting: "Cross-team sync, your team and platform, forty minutes in, going in circles.",
    domain: "field",
    transcript:
      "Look, we can't just give you write access to the cluster. I know it slows you down. We've been saying for a year that we want to get to a self-service model and I still want that. But right now every time someone outside platform touches it we spend a day cleaning up. So — I don't know. I hear you. It's just not something I can sign off on today.",
    fits: ["constraint-reveal", "name-the-unsaid", "smallest-test", "decision-owner"],
    trap: "Re-arguing why you need access. You have said it, they agreed, and it changed nothing — which is the signal the blocker is not the one being discussed.",
  },

  // ── outside the field ───────────────────────────────────────────────────────
  {
    id: "s09",
    setting: "City council session, planning item, public gallery half full.",
    domain: "random",
    transcript:
      "The proposal removes the minimum parking requirement for new residential developments in the central zone. Cities that have done this have seen housing costs come down and density go up. Portland did it in twenty-thirteen and rents stabilised within four years. We think it's the single most effective lever we have on affordability and it costs the city nothing to pull.",
    fits: ["analogy-test", "second-order", "evidence-source", "counterfactual"],
    trap: "Asking whether people will still need cars. It sounds practical and it is the argument the proposal has already been designed to survive.",
  },
  {
    id: "s10",
    setting: "Clinical governance meeting, hospital, twenty-five minutes in.",
    domain: "random",
    transcript:
      "The new sepsis screening tool flags about three times as many patients as the old scoring system. Mortality in the flagged group is down eleven percent year on year. Nursing staff are saying the alerts are constant — some wards are getting forty a shift. But I'd rather over-flag than miss one, so my recommendation is we keep it as is and put the training effort into response time instead.",
    fits: ["second-order", "unit-of-analysis", "threshold-ask", "silent-failure"],
    trap: "Arguing that alert fatigue is real. Everyone in the room knows it is; the unexamined move is treating over-flagging as costless when the nurses have just told you its price.",
  },
  {
    id: "s11",
    setting: "Board meeting, small logistics company, the CFO has the floor.",
    domain: "random",
    transcript:
      "Fuel is now thirty-one percent of our cost base, up from twenty-two two years ago. I'm proposing we lock in a twelve-month hedge at current prices. It caps the downside. Yes, if prices fall we've left money on the table, but we can plan, and right now we can't plan. Every quarter we're re-forecasting and it's costing us more in chaos than it would in premium.",
    fits: ["reversibility", "threshold-ask", "tradeoff-surfacer", "counterfactual"],
    trap: "Predicting the fuel price. Nobody in the room can, the proposal explicitly does not depend on it, and trying makes you sound like you missed the argument.",
  },
  {
    id: "s12",
    setting: "School governors, budget item, an hour in and people are tired.",
    domain: "random",
    transcript:
      "So we've got funding for one of the two: either the reading intervention programme for year three, or replacing the science labs. The reading programme has evidence behind it — the trial showed about four months of additional progress. The labs are twenty years old and honestly they're embarrassing when parents visit. I think we go with reading. It's the one with data.",
    fits: ["unit-of-analysis", "scope-narrow", "cost-of-delay", "level-shift"],
    trap: "Asking for more evidence on the labs. There will never be a trial for a building, and demanding symmetry in evidence quietly always favours whichever option was easier to measure.",
  },
  {
    id: "s13",
    setting: "Insurance underwriting review, four people, discussing a pricing change.",
    domain: "random",
    transcript:
      "The model's telling us to raise premiums about eighteen percent on the under-twenty-fives. Loss ratio in that segment has been bad for six quarters straight. I've checked it against last year and it holds. If we don't move, that book keeps bleeding. The pushback will be from sales because it's a growth segment for them, but the numbers are the numbers.",
    fits: ["mechanism-ask", "second-order", "assumption-probe", "concede-and-narrow"],
    trap: "Questioning whether the model is right. It has been checked, they will say so, and the interesting question is what an eighteen percent rise does to who stays in the book.",
  },
  {
    id: "s14",
    setting: "Sleep clinic research meeting, presenting a study design.",
    domain: "random",
    transcript:
      "We're going to look at whether later school start times improve outcomes. Two schools move to a nine-thirty start, two stay at eight-fifteen, we track attendance, grades and self-reported sleep over a year. The schools volunteered, which makes recruitment easy. If the effect is there it should be obvious — the sleep literature is pretty consistent on the adolescent phase delay.",
    fits: ["falsifier", "assumption-probe", "unit-of-analysis", "smallest-test"],
    trap: "Asking whether teenagers really need more sleep. That is the settled part. The design has a hole in it and it is the word 'volunteered'.",
  },
  {
    id: "s15",
    setting: "Central bank policy discussion, transcript from the minutes.",
    domain: "random",
    transcript:
      "Inflation has come down to two point four, which is close enough to target that I think we should start cutting. The labour market is loosening — vacancies are down, wage growth is decelerating. Waiting has a cost: monetary policy operates with a lag of somewhere between twelve and eighteen months, so by the time we see the damage in the data we've already done it.",
    fits: ["falsifier", "threshold-ask", "reversibility", "counterfactual"],
    trap: "Disputing the inflation number. It is published, it is not in doubt, and the argument being made rests entirely on a lag estimate with a six-month range in it.",
  },
  {
    id: "s16",
    setting: "Restaurant group ops meeting, discussing a rollout to fourteen sites.",
    domain: "random",
    transcript:
      "The new ordering system went into the Camden site in March and it's been great — table turnover is up about twelve minutes, staff prefer it, complaints are down. I want it in all fourteen by the end of summer. Camden's our busiest site so if it works there it'll work anywhere. We've got the budget, it's mostly just installation and a day of training per site.",
    fits: ["scope-narrow", "analogy-test", "failure-mode", "smallest-test"],
    trap: "Asking about the budget. It has been accounted for and it is not where this goes wrong — 'if it works at the busiest site it works anywhere' is an inference nobody has checked.",
  },
];

export const SCENARIOS_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

/**
 * Deterministic per day, same discipline as the Arena: an unseen scenario if one
 * exists, and never two from the same domain in a row.
 */
export function pickScenario(opts: {
  usedIds: string[];
  lastDomain?: "field" | "random";
  seed?: number;
}): Scenario {
  const used = new Set(opts.usedIds);
  const want: "field" | "random" = opts.lastDomain === "field" ? "random" : "field";

  const pools = [
    SCENARIOS.filter((s) => !used.has(s.id) && s.domain === want),
    SCENARIOS.filter((s) => !used.has(s.id)),
    SCENARIOS.filter((s) => s.domain === want),
    SCENARIOS,
  ];
  const pool = pools.find((p) => p.length > 0) ?? SCENARIOS;
  const day = opts.seed ?? Math.floor(Date.now() / 86_400_000);
  return pool[day % pool.length]!;
}
