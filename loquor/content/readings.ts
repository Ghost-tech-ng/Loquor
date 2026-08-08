// The Readings — long-form material for the read-aloud drill.
//
// Replaces the 130-word scenario paragraphs from v0.1.1. Those were a minute
// each and read like exercises, which is exactly what they were. The rules now:
//
//   1. Ten minutes minimum. At a measured 130 wpm that is ~1,300 words, so each
//      reading runs 1,300-1,500. Stamina is part of what is being trained —
//      a minute of reading never reaches the point where your voice tires and
//      your phrasing collapses, which is the point worth practising.
//   2. It has to be worth reading. Each of these is either a true story or a
//      genuine explanation of something. If you learned nothing but the words,
//      the passage failed.
//   3. Target words are USED, never defined. The gloss lives in the glossary and
//      you read it before you start, not inside the sentence.
//   4. Six sections, one recording each. A ten-minute single take is a bad unit:
//      one cough at minute nine costs you the whole thing, the upload is large,
//      and the alignment table gets big enough to matter on a phone. Sections
//      are ~220 words — under two minutes, cheap to redo, and each one gets its
//      own marked-up feedback while you still remember saying it.
//
// The four target words per section are the same entries the Lexicon schedules.
// Reading one aloud correctly credits the recognition track; producing it in the
// Arena credits the production track. One corpus, two drills.

import { gloss, type Gloss } from "./glossary.ts";
import { tokenizeReference } from "../lib/reading.ts";

export type Section = {
  n: number;
  heading: string;
  text: string;
  targets: string[];
};

export type Reading = {
  id: string;
  title: string;
  standfirst: string;
  domain: "field" | "random";
  sections: Section[];
};

// Source text is written across many lines for legibility; the reader should see
// one clean paragraph.
const p = (s: string) => s.replace(/\s+/g, " ").trim();

export const READINGS: Reading[] = [
  {
    id: "r01",
    title: "The Machine That Learned to Listen",
    standfirst:
      "Seventy years of speech recognition, and why the model transcribing you was built to throw away exactly the thing you are trying to fix.",
    domain: "field",
    sections: [
      {
        n: 1,
        heading: "Audrey, 1952",
        targets: ["tractable", "precedent", "non-trivial", "threshold"],
        text: p(`
          In 1952 three engineers at Bell Laboratories built a machine they called Audrey.
          It filled a relay rack, drew enough power to warm the room, and could recognise
          the spoken digits zero through nine. Not words. Digits. And only when spoken by
          one particular person, slowly, with a pause after each one. If a stranger walked
          up and said "seven", Audrey was roughly as accurate as a coin. There is a version
          of this story where that is a failure, and it is the wrong version. What those
          engineers had done was take a problem nobody could describe and make it small
          enough to attack. Speech in general was hopeless in 1952. Ten digits from one
          speaker was tractable. Every serious advance in the field for the next fifty years
          followed the same shape: someone found a smaller question, answered it properly,
          and the answer turned out to generalise further than anyone expected. Audrey set
          the precedent for that method, and for something less flattering too. It worked by
          measuring where the energy in the signal sat across frequency, then matching that
          against stored patterns. Sensible, and a dead end. The engineering was
          non-trivial and the ceiling was low. Getting from ten digits to a hundred words
          was not ten times harder; it was a different problem wearing the same coat. The
          field would spend two decades discovering that each new vocabulary size was its
          own threshold, and that crossing one bought you almost nothing toward the next.
        `),
      },
      {
        n: 2,
        heading: "The decade of hand-built rules",
        targets: ["incremental", "heuristic", "plateau", "brittle"],
        text: p(`
          IBM demonstrated a machine called Shoebox at the 1962 World's Fair in Seattle. It
          understood sixteen words, mostly digits and arithmetic commands, and it could add
          numbers you read to it. Impressive on a stage. Useless in an office. Through the
          sixties and into the seventies the dominant approach was to write down what
          linguists knew and turn it into rules: this sound followed by that sound in this
          position produces this effect, and here is the exception, and here is the exception
          to the exception. Progress was real but incremental, and it arrived at a rate that
          suggested the finish line was somewhere beyond the end of everyone's career. Each
          system was a stack of heuristic decisions, and each heuristic had been tuned by a
          human being who had listened to recordings until their ears rang. In the lab the
          numbers improved every year. In the world, they did not. What the field hit was a
          plateau, and the shape of it was informative: performance was excellent on the data
          the rules had been written against and fell apart on anything else. A speaker with
          a cold. A slightly different microphone. A word said at the end of a sentence
          rather than the start. The systems were not fragile in the ordinary sense — they
          were brittle, working perfectly right up to the moment conditions shifted an inch,
          then failing completely rather than gracefully. Nobody had built a machine that
          could handle being surprised.
        `),
      },
      {
        n: 3,
        heading: "Jelinek's heresy",
        targets: ["paradigm", "empirical", "orthodoxy", "supplant"],
        text: p(`
          In 1971 the American defence research agency funded a five-year programme in
          speech understanding, and by 1976 a system from Carnegie Mellon called Harpy could
          handle a vocabulary of about a thousand words. It won by cheating in a way that
          turned out not to be cheating. Instead of reasoning about language, Harpy searched
          a graph of everything the system was allowed to hear, and picked the path that
          scored best. Around the same time, at IBM, a group under Fred Jelinek was doing
          something the linguistics community found close to offensive. They stopped asking
          what language is and started counting what language does. Which word follows which,
          how often, in millions of words of text. It was a paradigm change rather than an
          improvement, and it was resisted accordingly, because the new method threw away
          decades of hard-won expertise and replaced it with arithmetic over a large pile of
          examples. The line attributed to Jelinek — that every time he fired a linguist, the
          system got better — was probably never said quite that way, and it stung anyway.
          The argument was empirical and it was settled empirically: the statistical systems
          scored higher, year after year, against the same tests. By the late eighties the
          orthodoxy had inverted. Hidden Markov models, which describe speech as a chain of
          states each emitting sound with some probability, had supplanted the rule-writers
          almost entirely, and would hold the field for the next twenty years.
        `),
      },
      {
        n: 4,
        heading: "What the numbers actually measured",
        targets: ["stochastic", "benchmark", "converge", "salient"],
        text: p(`
          The word to keep is stochastic. These models did not claim to know what you said.
          They described the range of things you might have said, attached a probability to
          each, and returned the most likely one. Kai-Fu Lee's Sphinx, in 1988, was the first
          to do this well enough to handle continuous speech from a speaker it had never
          heard before — no pauses between words, no training session, just talk. That
          combination, speaker independence and continuous speech, is the one that separates
          a demonstration from a product. It also created a problem the field has never
          fully escaped. To compare two systems you need a fixed test, so the community built
          shared ones: recorded telephone calls, dictated newspaper text, meeting
          audio. A benchmark is enormously useful and it quietly becomes the definition of
          the task. Researchers would converge on the same handful of test sets, tune against
          them for years, and publish improvements measured in tenths of a percent that
          reflected the test set as much as the technology. In 2016 Microsoft reported a word
          error rate of 5.9 percent on one of these, a conversational telephone corpus, and
          announced parity with human transcribers. The claim was contested immediately, and
          the salient objection was not that the number was wrong. It was that human
          transcribers and machines fail differently. A person mishears a name. A machine
          confidently produces a fluent sentence that was never spoken.
        `),
      },
      {
        n: 5,
        heading: "The neural turn",
        targets: ["robust", "granular", "proxy", "diminishing returns"],
        text: p(`
          Between 2009 and 2012 the ground moved again. Deep neural networks, an idea that
          had been around for decades and had never quite worked at scale, started replacing
          the component of the system that decided which sound was being made. The
          improvements were not the usual tenths of a percent. Error rates fell by a third
          and in some conditions by more, across several research groups at once, which is
          the signature of a real advance rather than a good year. What the networks bought,
          more than raw accuracy, was being robust to things nobody had designed for:
          background noise, accents outside the training data, a phone held at the wrong
          angle. Rule-based systems had needed a granular account of every variation in
          advance. The networks learned the variation from examples and never produced an
          account of anything. Over the following decade the architecture kept changing —
          recurrent networks, then attention, then transformers — and each change bought
          less than the one before. By the early 2020s, tuning the model was hitting
          diminishing returns, and the leverage had moved decisively to data. Which raises
          the question everyone in machine learning eventually meets: what exactly is the
          training data a proxy for? A model trained on audiobooks learns to hear people
          reading. A model trained on broadcast news learns to hear professionals. Neither
          learns to hear a tired person on a bad line trying to finish a thought they have
          not fully had yet.
        `),
      },
      {
        n: 6,
        heading: "Why it deletes your hesitation",
        targets: ["ubiquitous", "corollary", "second-order", "latent"],
        text: p(`
          In 2022 OpenAI released Whisper, trained on around 680,000 hours of audio scraped
          from the internet with whatever text happened to accompany it. No careful
          annotation, no controlled recording conditions, just enormous scale and weak
          supervision. It was released openly, it ran on ordinary hardware, and within a
          couple of years automatic transcription had become ubiquitous — a feature in note
          apps and video tools rather than a product anyone shopped for. Seventy years from
          a relay rack recognising ten digits to a thing nobody remarks on. But look at what
          it was trained to produce. The target text was captions, transcripts, subtitles:
          text written by humans for humans to read, which means cleaned up. Nobody writes a
          subtitle that reads "so, um, the thing is, uh, I think". They write "the thing is,
          I think". The corollary is unavoidable and it is the reason this application
          exists. A model trained to produce readable text learns that hesitation is noise
          and removes it, so the more fluent the transcript looks, the less it can tell you
          about how you actually sounded. The flaw was latent in the training data from the
          first day, and nobody had to intend it for it to be there. That is what makes it
          worth stating plainly: it is a second-order effect of an entirely
          reasonable decision, and it means the machine you are reading this into is,
          by design, the last thing that will honestly report your filler words. Every
          measurement in this app is built around that limitation rather than in ignorance
          of it.
        `),
      },
    ],
  },

  {
    id: "r02",
    title: "The Doctor Who Was Right",
    standfirst:
      "Ignaz Semmelweis had the evidence, the numbers, and the dead colleague to prove it. He lost anyway. A study in how not to persuade.",
    domain: "random",
    sections: [
      {
        n: 1,
        heading: "Two doors",
        targets: ["anomaly", "prevailing", "aggregate", "marginal"],
        text: p(`
          The Vienna General Hospital had two maternity clinics, and in the 1840s the women
          of Vienna knew which one they wanted. Admission alternated by day, and women who
          arrived on the wrong day begged, wept, and occasionally gave birth in the street
          rather than go to the first clinic. They were not being superstitious. They were
          reading the death rate, which everyone in the neighbourhood could recite. In the
          First Clinic, where medical students trained, roughly one mother in ten died of
          what was then called childbed fever. In the Second Clinic, staffed by midwives,
          the figure was closer to one in twenty-five, and in some years better than that.
          Same building. Same city. Same year. A young Hungarian doctor named Ignaz
          Semmelweis was appointed assistant in the First Clinic in 1846, and he could not
          leave this anomaly alone. The prevailing explanation was miasma — bad air rising
          from the ground, carrying disease — and the difficulty with miasma as a theory is
          that it explains everything and predicts nothing. The two clinics shared the same
          air. They shared the same street, the same weather, the same food. Looked at in
          aggregate, the hospital had a mortality problem. Looked at door by door, it had
          something much stranger, and the difference between the doors was not marginal.
          It was a factor of three or four, sustained over years, in a building where every
          other variable anyone could name was held constant.
        `),
      },
      {
        n: 2,
        heading: "The scalpel",
        targets: ["proximate", "counterfactual", "systemic", "corroborate"],
        text: p(`
          Semmelweis worked through the candidates one at a time, and the discipline of it is
          the part worth admiring. Overcrowding: ruled out, since the Second Clinic was
          fuller. Climate: identical. The position women gave birth in differed between the
          clinics, so he changed it, and nothing happened. A priest walked through the First
          Clinic ringing a bell for the dying, which the staff thought terrified the patients,
          so he had the priest rerouted, silently. Nothing happened. Then in March 1847 his
          friend and colleague Jakob Kolletschka died. During an autopsy a student's scalpel
          had nicked Kolletschka's finger, and the illness that followed looked, in every
          detail, like childbed fever. Semmelweis had his answer, and it arrived the way
          answers usually do, through a death rather than an experiment. The proximate cause
          was the wound. The real one was what had been on the blade. Medical students spent
          their mornings dissecting corpses and their afternoons examining women in labour,
          washing their hands in between with nothing but water. Midwives never touched a
          cadaver at all. The counterfactual now wrote itself: if the students had come from
          anywhere else, the two clinics would have looked the same. This was not one careless
          man but a systemic feature of how the hospital taught medicine, and Semmelweis
          could corroborate it against every fact he had already gathered, including the
          uncomfortable one that the teaching clinic was the deadly one.
        `),
      },
      {
        n: 3,
        heading: "Chlorinated lime",
        targets: ["plausible", "categorical", "warranted", "empirical"],
        text: p(`
          In May 1847 he ordered every doctor and student entering the First Clinic to wash
          their hands in a solution of chlorinated lime. He chose it for a reason that now
          reads as almost comic: it was the only thing he could find that removed the smell
          of the dissecting room. He had no germ theory. He had no organism, no mechanism, no
          name for the thing he was removing — only the idea that some invisible material
          from the dead was being carried on hands into the living, and that this was
          plausible enough to act on. The mortality rate in the First Clinic fell from around
          eighteen percent in April to about two percent by summer, and stayed down. In one
          later month it reached zero. Consider what he was holding: a categorical
          intervention, applied to everyone entering one clinic, with a before-and-after
          effect large enough that no statistical argument was needed to see it. The
          conclusion was warranted in a way that very little medicine of that era was
          warranted. It was also, and this is the trap, entirely empirical. He could show
          that washing worked. He could not say what it removed, and he could not explain why
          it should work, because the explanation would not exist for another twenty years.
          To his colleagues that gap was not a detail. It was the whole objection, and he
          never found a way to answer it.
        `),
      },
      {
        n: 4,
        heading: "The insult",
        targets: ["entrenched", "deference", "dissent", "repudiate"],
        text: p(`
          His claim was not merely unfamiliar. It was an accusation. If Semmelweis was right,
          then Vienna's physicians had spent their careers carrying death from the mortuary to
          the delivery room on their own hands, and had killed, personally and repeatedly,
          the patients they were most proud of saving. Medicine in the 1840s was a profession
          built on the authority of the gentleman practitioner, an identity so entrenched
          that the idea of a doctor's hands being unclean was closer to an insult about class
          than a hypothesis about disease. Semmelweis understood this and made it worse. He
          did not publish for fourteen years. When he finally did, in 1861, the book was
          disorganised and furious, and he followed it with open letters to the leading
          obstetricians of Europe calling them irresponsible murderers. There is a version of
          this campaign that could have worked. He had a supporter or two in Vienna, and
          arithmetic on his side that any competent physician could check in a season. What
          he needed was for the deference the profession paid to its seniors to be turned in
          his favour rather than against him, which meant giving those seniors a route to
          agreeing that did not require confessing to manslaughter. Instead he made dissent
          from his position identical to admitting guilt, and having done that, he was
          genuinely surprised that so many chose to repudiate the whole thing rather than
          take it up.
        `),
      },
      {
        n: 5,
        heading: "The cost",
        targets: ["untenable", "tenuous", "capitulate", "hyperbole"],
        text: p(`
          His position in Vienna became untenable and he left for Pest in 1850, where he ran
          a maternity ward and drove its mortality rate down to about one percent, a result
          that ought to have ended the argument and did not. Handwashing was adopted in a
          few places by people who had met him and dropped everywhere else. The reasoning
          against it stayed tenuous the entire time — that his statistics were unreliable,
          that his mechanism was absent, that the effect must be something about Vienna —
          and none of it needed to be strong, because the burden had somehow settled on him
          rather than on the practice of not washing. He did not capitulate. That was never
          the risk with Semmelweis. His writing grew more extreme, the hyperbole in it
          thickened until it obscured the numbers underneath, and by his early forties his
          behaviour had become erratic enough to alarm the people around him. In 1865 he was
          taken, apparently under a pretext, to an asylum in Vienna. He tried to leave, was
          restrained by guards, and died two weeks later at forty-seven, of an infected
          wound. The illness that killed him was, in the most bitter sense available, the
          thing he had spent his life trying to prevent, and it was contracted in the same
          way he had spent his life describing.
        `),
      },
      {
        n: 6,
        heading: "What being right is worth",
        targets: ["vindicate", "hindsight", "caveat", "nuance"],
        text: p(`
          Two years after he died, Joseph Lister began publishing on antisepsis in surgery,
          building on Pasteur's work on fermentation and putrefaction. Within a generation
          germ theory had supplied the mechanism Semmelweis lacked, handwashing became
          unremarkable, and he was retrospectively made a hero of medicine. The term
          "Semmelweis reflex" now names the tendency of an institution to reject a finding
          because of who brought it and what accepting it would cost. It is a real pattern
          and it does vindicate him, though it is worth noticing what the label does. It
          places the entire failure on his audience. In hindsight the evidence looks
          overwhelming, which is exactly what hindsight does to evidence, and the honest
          reading is harder than the heroic one. The caveat that mattered to his contemporaries
          was genuine: he was asking them to change practice on a correlation with no
          mechanism, in a decade when medicine was full of confident men with correlations,
          most of whom were wrong. What separates his case is not that he had better manners
          available. It is that he had a test anyone could run, and never built a path for a
          senior physician to run it without humiliation. The nuance to carry out of this is
          uncomfortable and it is the whole point: being right is a claim about the world,
          and being persuasive is a claim about people, and they are separate problems that
          have to be solved separately.
        `),
      },
    ],
  },

  {
    id: "r03",
    title: "The Ninety Seconds Before You Speak",
    standfirst:
      "What research on groups actually says about why good points go unsaid, and what the people who get heard are doing differently.",
    domain: "field",
    sections: [
      {
        n: 1,
        heading: "The opening move",
        targets: ["banal", "rapport", "reciprocate", "candid"],
        text: p(`
          Almost every professional conversation opens with an exchange neither party wants:
          the weather, the traffic, how busy things have been. It is easy to be contemptuous
          about this, and the contempt is misplaced. Banal opening talk is doing a job, and
          the job is not information. It is establishing that both people are willing to
          spend attention on each other before anything is at stake, which is the actual
          precondition for rapport. What is worth noticing is how long people stay there.
          The exchange is designed to be exited, and most conversations that go nowhere are
          ones where nobody made the move out. The move itself is small. You say something
          slightly more specific than the format requires — not an opinion, not a
          confession, just a real detail about what you are working on or stuck on — and
          then you stop and see what comes back. If the other person reciprocates with a
          detail of their own, you now have a conversation. If they return another
          pleasantry, you have your answer and you can leave gracefully. The reason this
          works is that disclosure has to move first, and it cannot be requested. Asking
          someone to be candid with you before you have been candid with them is a demand
          dressed as an invitation, and people feel the difference immediately even when
          they could not name it.
        `),
      },
      {
        n: 2,
        heading: "Contributing without volume",
        targets: ["interject", "substantive", "perfunctory", "articulate"],
        text: p(`
          In any meeting of more than four people, the amount said correlates poorly with
          the amount contributed, and everyone in the room knows this while continuing to
          reward volume anyway. The reason is a measurement problem. Contribution is hard to
          assess in real time; airtime is trivial to assess. So if you speak rarely, the
          burden on each thing you say is higher, and the single most useful skill is
          knowing how to interject in a conversation that is not leaving gaps. There is a
          technique and it is unglamorous: you take a breath audibly, say three or four
          words that signal you are adding rather than objecting, and then make one point.
          "Building on that —". "One thing —". The words are not the content; they are a
          claim on the next four seconds. What follows has to be substantive, meaning it
          goes to the matter rather than the framing. An objection about wording, delivered
          well, still leaves the room where it was. And there is a failure mode on the other
          side worth avoiding. A perfunctory contribution — agreeing warmly, restating what
          was just said, praising the analysis — costs nothing and returns nothing, and
          repeated often enough it teaches people to stop attending when you start. The most
          reliably valued thing you can do in a meeting is articulate the tension everyone
          is already feeling and nobody has put into words.
        `),
      },
      {
        n: 3,
        heading: "Why rooms agree with the wrong person",
        targets: ["consensus", "deference", "dissent", "moot"],
        text: p(`
          In 1951 Solomon Asch ran an experiment so simple it is almost insulting. He showed
          people a line and asked which of three other lines matched it. The answer was
          obvious. But the subject was seated with a group of actors who all confidently gave
          the same wrong answer first, and about three-quarters of subjects went along with
          them at least once. What Asch had demonstrated was not stupidity. It was that
          agreement is socially expensive to withhold, and the price of dissent rises with
          every voice that has already gone the other way. Two things follow for any meeting
          you sit in. The
          first is that consensus and unanimity are not the same object, and treating an
          absence of objection as agreement is how organisations commit to things nobody
          supports. The second is that order matters enormously. Whoever speaks first sets
          the frame, and the deference paid to seniority means that when the most senior
          person speaks first, the discussion afterwards is largely decoration. Amazon's
          answer to this is worth knowing even if you never adopt it: meetings open with
          twenty or thirty minutes of silence while everyone reads a written narrative, so
          that opinions form before anyone hears whose opinion it is. If you have no
          mechanism at all, the cheapest one available is to write your position down before
          the meeting starts. Then, when the room turns, you know whether you were persuaded
          or merely outnumbered — and if the decision has already been taken elsewhere, you
          find out that the discussion was moot before you spend an hour in it.
        `),
      },
      {
        n: 4,
        heading: "The question that does work",
        targets: ["elicit", "granular", "salient", "digress"],
        text: p(`
          There is a category of question that makes a room think and another that makes it
          perform, and the difference is not intelligence. It is whether the question can be
          answered from what the person already has loaded. "What do you think about the
          roadmap?" produces a summary they have given four times. A good question is built
          to elicit something they have not yet said out loud, which usually means it is more
          specific rather than more clever. Ask what changed their mind. Ask which part they
          are least confident in. Ask what they would need to see to abandon it. Each of
          these is granular in a way that leaves no room to answer in headlines. There is a
          second property worth designing for. Good questions tend to be the ones you
          genuinely want the answer to, because interest is audible and its absence is
          audible too. The one discipline required is knowing which thread is salient and
          which is merely interesting, because a question that opens a fascinating side road
          in the last ten minutes of a meeting is a hostile act however well meant. If you
          want to digress, say so, take it, and close it deliberately — announcing the
          detour is what makes it welcome rather than derailing.
        `),
      },
      {
        n: 5,
        heading: "Disagreeing so that it survives",
        targets: ["concede", "tenuous", "corroborate", "caveat"],
        text: p(`
          The single most effective opening in a disagreement is to give away the strongest
          thing the other side has, before they have to defend it. Concede the point that is
          genuinely good, name it accurately, and only then say where you part company. This
          is not politeness and it is not a trick. It does two things mechanically: it proves
          you understood the argument rather than a cartoon of it, and it removes the
          opponent's easiest move, which is to assume you have missed something. Once that is
          done, be specific about where the disagreement actually lives. Most disputes that
          run long are not disputes about the conclusion at all — they are disputes about one
          link in the middle that both sides have left unexamined, and finding that link is
          more valuable than winning. Say which step you think is tenuous and why. Then bring
          something to corroborate your side that did not come from you: a number someone
          else measured, a case from another team, a customer who said it unprompted. Your own
          restatement of your own position is not evidence, however confidently delivered.
          And attach your caveat honestly. Naming the condition under which you would be
          wrong makes the rest of your case more credible, not less, and it costs you almost
          nothing because the condition was always there whether or not you mentioned it.
        `),
      },
      {
        n: 6,
        heading: "What people remember",
        targets: ["anecdote", "superfluous", "epitome", "hindsight"],
        text: p(`
          A week after any meeting, almost nothing survives. What survives is disproportionately
          narrative: one specific case with a person in it and a thing that happened. This is
          why the well-placed anecdote outperforms the well-constructed argument in memory,
          and it is also why it is dangerous, because a story that illustrates a claim feels
          like a story that proves one. The discipline is to carry one per conversation, make
          it thirty seconds long, and be honest with yourself about whether it is evidence or
          illustration. Everything after the point has landed is superfluous — and the most
          common failure among people who are good at this is not saying too little, it is
          carrying on past the moment the room agreed with them, at which point they start
          arguing against themselves on behalf of an opponent who has already stopped
          objecting. Stop early. Leave the last inference to the room. The epitome of a good
          contribution is one sentence the room repeats afterwards without remembering who
          said it, and if that sounds like a poor deal, notice that being quoted is worth more
          than being credited in almost every setting that matters. None of this is natural
          and none of it is charisma. It is a set of moves that can be practised, badly at
          first, and the only reason it looks like personality is that we only ever see it in
          hindsight, in people who have already done the practising.
        `),
      },
    ],
  },

  {
    id: "r04",
    title: "The Box That Ate the World",
    standfirst:
      "A trucking man with no shipping experience invented the steel container, gave away the patents, and rearranged the map of global trade.",
    domain: "random",
    sections: [
      {
        n: 1,
        heading: "The cost of loading",
        targets: ["throughput", "friction", "bottleneck", "commodity"],
        text: p(`
          Before 1956, putting cargo on a ship meant putting cargo on a ship. Barrels, sacks,
          crates, bales and drums arrived at a pier by truck, were unloaded by hand, sorted,
          stacked on the dock, lifted by crane in slings, then restacked in the hold by gangs
          of longshoremen who fitted each awkward item against the next like a puzzle. A ship
          could spend a week in port for every week at sea. The throughput of a berth was
          limited not by the vessel and not by the ocean but by how fast human arms could
          move irregular objects, and by the theft, breakage and paperwork that accumulated
          at every transfer. Economists later estimated that loading loose cargo this way
          cost in the region of five dollars and eighty-six cents per ton, against sixteen
          cents per ton once the same goods travelled in containers. Nearly all of that
          difference was friction: effort that moved nothing closer to its destination. The
          bottleneck was never the crossing. Ocean freight was already cheap and reliable in
          1950; it was the two ends that ate the money, and because everybody in the industry
          had grown up with that fact, almost nobody treated it as a problem rather than a
          condition. Shipping was understood as a commodity business where the only lever was
          price per voyage, and firms competed on that lever exclusively.
        `),
      },
      {
        n: 2,
        heading: "Ideal-X",
        targets: ["incumbent", "precedent", "non-trivial", "marginal"],
        text: p(`
          Malcolm McLean was not a shipping man. He had built one of the largest trucking
          companies in the United States starting from a single second-hand vehicle, and his
          irritation was specific: he had watched his drivers sit at piers for hours while
          their loads were unpacked and repacked. His idea was to move the container rather
          than the cargo — lift the whole truck body onto the ship and lift it off at the
          other end, never touching what was inside. To pursue it he sold his trucking firm
          outright, because American regulation would not let him own both, and bought a
          small steamship line. On 26 April 1956 a converted tanker called Ideal-X sailed
          from Newark to Houston carrying fifty-eight containers on a reinforced deck. The
          incumbent operators were not much alarmed. There was no obvious precedent for a
          trucker succeeding in ocean freight, the engineering was non-trivial and unproven,
          and the whole thing looked like a marginal improvement on a process that already
          worked. That reading was reasonable and completely wrong, and the reason it was
          wrong is instructive. McLean had not built a better way of loading ships. He had
          begun, without saying so, to build a different unit of trade, and the ship was
          only the part of it that was visible from the dock.
        `),
      },
      {
        n: 3,
        heading: "The boring, decisive part",
        targets: ["interoperable", "canonical", "obviate", "coupling"],
        text: p(`
          A container is only useful if the crane, the chassis, the railcar and the ship at
          the far end can all handle it, and in the early years they could not, because every
          operator built its own. McLean's boxes were thirty-five feet long, matching the
          road limits of the states he trucked in. Matson, on the Pacific, used twenty-four
          feet, sized to Hawaiian cargo. A box that fits one company's equipment and nobody
          else's is not a container, it is a proprietary crate, and the industry spent the
          early sixties in exactly that impasse. What broke it was standardisation work
          through the International Organization for Standardization, arriving at the
          dimensions and corner fittings still in use today, and McLean's decision to release
          his patent rights on the corner fitting so that anyone could build to the standard
          without paying him. Giving away the invention is what made the invention worth
          having. Once boxes were interoperable, a container ceased to be equipment belonging
          to a carrier and became a canonical unit that any port, railway or haulier could
          handle without arrangement. That in turn served to obviate the entire trade of
          fitting mixed cargo into a hold — the job did not get easier, it stopped existing.
          And the tight coupling between a shipper and its carrier, which had been the
          industry's main source of pricing power, quietly dissolved.
        `),
      },
      {
        n: 4,
        heading: "Who paid",
        targets: ["externality", "attrition", "capitulate", "entrenched"],
        text: p(`
          Every account of containerisation that treats it as a clean efficiency story is
          leaving out the docks. New York harbour employed tens of thousands of longshoremen
          in the fifties, in a trade that was dangerous, casual and fiercely organised, and
          within twenty years most of those jobs were gone. The cost did not land on the
          shipping lines that captured the savings or the manufacturers who got cheaper
          freight. It landed on dock neighbourhoods in Brooklyn, Liverpool and London — an
          externality in the strict sense, borne entirely outside the transaction. The unions
          were not naive about what was coming. On the American west coast the longshoremen's
          union signed an agreement in 1960 accepting mechanisation in exchange for
          guaranteed earnings and funded early retirement, converting an immediate mass
          redundancy into slow attrition. On the east coast the fight was longer and
          uglier. It is too simple to say the unions capitulated; what they did was trade a
          fight they could not win for terms they could still influence, which is usually the
          only trade on offer. Ports responded differently and their responses were
          entrenched by geography. Manhattan's finger piers had no land behind them for
          stacking boxes, so the traffic crossed the river to Newark and Elizabeth. London's
          docks lost to Felixstowe. In each case a place that had handled cargo for centuries
          stopped, in about a decade.
        `),
      },
      {
        n: 5,
        heading: "Ports as capital",
        targets: ["amortise", "consolidate", "obsolete", "path dependence"],
        text: p(`
          Containers turned ports from labour businesses into capital businesses, and that
          changed which ports could exist. A container terminal needs gantry cranes, deep
          water, and many hectares of flat land for stacking, and it needs enough traffic to
          amortise all of that across decades. A port that could not raise the money did not
          get a smaller share of the trade; it got none, because a ship will sail past six
          ports to call at one that can turn it around in a day. So the traffic began to
          consolidate into a small number of very large terminals, and the hundreds of
          working harbours that had served regional trade became commercially obsolete while
          remaining perfectly functional. The Vietnam War accelerated all of this: the United
          States military needed to supply a distant theatre with poor port infrastructure,
          containers solved that problem convincingly, and the ships returning empty across
          the Pacific began calling at Japan for cargo, which is one of the ways Japanese
          manufacturing found its route into American homes. What the industry acquired in
          those years is path dependence in its purest form. The dimensions of a modern
          container still descend from the road limits of American states in the 1950s, and
          every crane, chassis, railcar, ship and warehouse door built since has been sized
          to match a decision nobody would make from scratch today.
        `),
      },
      {
        n: 6,
        heading: "Second-order",
        targets: ["second-order", "inflection point", "supplant", "aggregate"],
        text: p(`
          The direct effect of the container was cheaper loading. The second-order effects
          are the ones that rearranged the century. When shipping a component across an ocean
          costs almost nothing relative to its value, the question of where to make things
          detaches from the question of where to sell them, and a factory can be sited purely
          on labour cost, or subsidy, or proximity to a supplier. Manufacturing that had
          clustered near its customers for a hundred years dispersed across Asia. Inventory
          could be held on the water rather than in a warehouse, which made just-in-time
          production feasible and, much later, made a container ship wedged sideways in the
          Suez Canal a problem for factories on three continents. It is fair to call the
          mid-1960s an inflection point for global trade — not because trade began growing,
          but because the rate at which it grew changed character, and stayed changed for
          fifty years. None of this was in the plan. McLean wanted his trucks to stop waiting
          at piers. What he actually did was supplant one unit of commerce with another, and
          the aggregate consequence was a world where the physical distance between a factory
          and a customer stopped being a serious constraint on either. The lesson people take
          from the story is usually about innovation. The better lesson is about standards:
          the invention was the box, but the value was in everyone agreeing on its corners.
        `),
      },
    ],
  },
];

export const READINGS_BY_ID: ReadonlyMap<string, Reading> = new Map(READINGS.map((r) => [r.id, r]));

/** Every gloss a reading will ask for, in section order, deduplicated. */
export function readingGlosses(reading: Reading): Gloss[] {
  const seen = new Set<string>();
  const out: Gloss[] = [];
  for (const sec of reading.sections) {
    for (const w of sec.targets) {
      if (seen.has(w)) continue;
      seen.add(w);
      const g = gloss(w);
      if (g) out.push(g);
    }
  }
  return out;
}

export function sectionGlosses(section: Section): Gloss[] {
  const seen = new Set<string>();
  const out: Gloss[] = [];
  for (const w of section.targets) {
    if (seen.has(w)) continue;
    seen.add(w);
    const g = gloss(w);
    if (g) out.push(g);
  }
  return out;
}

export function wordCount(section: Section): number {
  return tokenizeReference(section.text).tokens.length;
}

export function readingWordCount(reading: Reading): number {
  return reading.sections.reduce((n, s) => n + wordCount(s), 0);
}

/** At a measured reading pace. Deliberately conservative — 130, not 160. */
export const READ_WPM = 130;

export function readingMinutes(reading: Reading): number {
  return readingWordCount(reading) / READ_WPM;
}

/**
 * Which token indices in a section are targets.
 *
 * Multi-word entries ("second-order", "path dependence") must match the full
 * sequence exactly. Single words match on a stem, so "converge" also catches
 * "converged" and "convergence" — but only the first hit, since later
 * occurrences are reinforcement rather than the thing being tested.
 */
export function targetIndices(section: Section): Map<number, string> {
  const { tokens } = tokenizeReference(section.text);
  const out = new Map<number, string>();
  for (const word of section.targets) {
    const parts = tokenizeReference(word).tokens;
    const head = parts[0];
    if (head === undefined) continue;
    for (let i = 0; i < tokens.length; i++) {
      if (parts.length > 1) {
        if (!parts.every((p, k) => tokens[i + k] === p)) continue;
      } else {
        const stem = head.slice(0, Math.max(4, Math.floor(head.length * 0.7)));
        if (!tokens[i]!.startsWith(stem)) continue;
      }
      for (let k = 0; k < parts.length && i + k < tokens.length; k++) out.set(i + k, word);
      break;
    }
  }
  return out;
}

/**
 * Which reading to offer today. Same rules as pickTopic: prefer one you have not
 * read, alternate field against random so two technical days never stack, and
 * make the choice deterministic per day so reopening the app does not reroll it.
 */
export function pickReading(args: {
  usedIds: string[];
  lastDomain?: Reading["domain"];
  date?: Date;
}): Reading {
  const used = new Set(args.usedIds);
  const other = args.lastDomain === "field" ? "random" : args.lastDomain === "random" ? "field" : null;

  const fresh = READINGS.filter((r) => !used.has(r.id));
  const pools = [
    other ? fresh.filter((r) => r.domain === other) : [],
    fresh,
    other ? READINGS.filter((r) => r.domain === other) : [],
    READINGS,
  ];
  const pool = pools.find((p) => p.length > 0)!;

  const d = args.date ?? new Date();
  const dayIndex = Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  );
  return pool[Math.abs(dayIndex) % pool.length]!;
}
