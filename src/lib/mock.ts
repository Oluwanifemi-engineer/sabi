import type { Analysis, Explanation, QuizQuestion } from "./types";
import type { AnalyzeOutput } from "./prompts";

/**
 * Offline demo engine. Runs when no LLM_API_KEY is configured so the full
 * flow (explain -> quiz -> sign) is demoable and testable without a key.
 * Output mirrors the real pipeline's JSON contract exactly, including the
 * simplify pass used when a parent fails the comprehension check.
 */

const ANALYSIS_BY_TYPE: Record<string, Analysis> = {
  consent: {
    type: "consent",
    urgency: "response-needed-by",
    deadline: "14 calendar days from the letter",
    actions: ["Sign and return the consent form", "Or ask the school your questions first"],
    keyFacts: [
      "The school wants permission to evaluate your child",
      "The evaluation checks how your child learns",
      "You have 14 calendar days to decide",
      "An interpreter is free if you ask",
    ],
    risksOfSigning: [
      "The evaluation takes time during school hours",
      "Results become part of your child's school record",
    ],
    rights: [
      "You can say no or ask questions first",
      "You can get this letter and the results in your language",
      "You can cancel consent in writing at any time",
    ],
  },
  iep: {
    type: "iep",
    urgency: "response-needed-by",
    deadline: "September 17 (reply slip)",
    actions: ["Confirm you will attend the meeting", "Or ask to reschedule"],
    keyFacts: [
      "The school invites you to an IEP meeting on September 24",
      "The team sets learning goals for your child",
      "You are a full member of this team",
      "An interpreter is free if you ask",
    ],
    risksOfSigning: ["Signing attendance only confirms you were there", "You do not have to agree to the plan at the meeting"],
    rights: [
      "You can bring someone to translate or support you",
      "You can disagree with the plan and say why",
      "You can get a copy of the plan in your language",
    ],
  },
  discipline: {
    type: "discipline",
    urgency: "action-required",
    deadline: "Conference on September 19, appeal within 5 school days",
    actions: ["Attend the conference", "Bring questions about what happened"],
    keyFacts: [
      "The school reports a cafeteria incident on September 11",
      "A suspension of up to 3 days is possible",
      "A meeting happens before any decision",
    ],
    risksOfSigning: ["A suspension goes into the student record", "Signing only confirms you received the notice"],
    rights: [
      "Your child has the right to tell their side",
      "You can see the evidence the school has",
      "You can appeal the decision in writing",
    ],
  },
  generic: {
    type: "generic",
    urgency: "fyi",
    deadline: undefined,
    actions: ["Read the letter", "Contact the school if anything is unclear"],
    keyFacts: ["This letter shares information from the school"],
    risksOfSigning: [],
    rights: ["You can ask for help in your language"],
  },
};

function explanationFor(type: string): Explanation {
  const base: Record<string, Explanation> = {
    consent: {
      headline: "The school asks your permission to test how your child learns",
      summary:
        "This is a consent form. It asks you to say yes to an evaluation. The evaluation is a set of tests and observations. It helps the school understand how your child learns best.",
      whatTheyAsk: "Sign the form to allow the evaluation, and return it to school.",
      ifYouSign:
        "School staff will test your child during school time. You will get a report with the results. The report goes into your child's school file.",
      ifYouDontSign:
        "The evaluation will not happen for now. Your child stays in their current class. Nothing bad happens if you ask questions first.",
      questionsToAsk: [
        "Which tests will my child take?",
        "How long will the evaluation take?",
        "When and how will I get the results?",
      ],
    },
    iep: {
      headline: "You are invited to a meeting about your child's learning plan",
      summary:
        "This is a meeting notice. The team writes a plan called an IEP. The plan sets learning goals and support for your child.",
      whatTheyAsk: "Tell them if you will come, and pick a time if needed.",
      ifYouSign:
        "You confirm you received this notice. At the meeting you can agree, disagree, or ask for changes.",
      ifYouDontSign: "The meeting may happen without you, but they must try to include you.",
      questionsToAsk: [
        "Who will be at the meeting?",
        "Can I bring an interpreter?",
        "What goals will you discuss?",
      ],
    },
    discipline: {
      headline: "The school reports an incident and invites you to a meeting",
      summary:
        "This is a discipline notice. The school says something happened on a school day. They want to meet you before deciding any punishment.",
      whatTheyAsk: "Come to the conference on the date in the letter.",
      ifYouSign:
        "You confirm you received this notice. Your child may get a suspension. The meeting decides.",
      ifYouDontSign: "The meeting can still happen, but come so your child's side is heard.",
      questionsToAsk: [
        "What exactly happened?",
        "What evidence does the school have?",
        "How long would any suspension last?",
      ],
    },
    generic: {
      headline: "Information from your child's school",
      summary: "This letter shares news and information. No signature is required.",
      whatTheyAsk: "Nothing right now. Just read it.",
      ifYouSign: "There is nothing to sign.",
      ifYouDontSign: "Nothing happens.",
      questionsToAsk: ["Can I get more details?", "Who can I call with questions?"],
    },
  };
  return base[type] ?? base.generic;
}

function quizFor(type: string): QuizQuestion[] {
  const sets: Record<string, QuizQuestion[]> = {
    consent: [
      {
        question: "What is this letter asking you to allow?",
        options: ["An evaluation of how your child learns", "A new school schedule", "A doctor visit at home"],
        correctIndex: 0,
        why: "The form asks for consent to evaluate your child.",
      },
      {
        question: "How many days do you have to decide?",
        options: ["14 calendar days", "2 school days", "There is no time limit"],
        correctIndex: 0,
        why: "The letter gives you 14 calendar days.",
      },
      {
        question: "Can you cancel your consent later?",
        options: ["Yes, in writing at any time", "No, it is permanent", "Only the school can cancel it"],
        correctIndex: 0,
        why: "You may cancel consent in writing at any time.",
      },
    ],
    iep: [
      {
        question: "What is the meeting about?",
        options: ["Your child's learning plan (IEP)", "School fees", "A sports tryout"],
        correctIndex: 0,
        why: "The notice invites you to an IEP team meeting.",
      },
      {
        question: "Are you part of the team that writes the plan?",
        options: ["Yes, a full member", "No, only teachers decide", "Only if you pay"],
        correctIndex: 0,
        why: "Parents are full IEP team members.",
      },
      {
        question: "Can you disagree with the plan?",
        options: ["Yes, and you can say why", "No", "Only the teacher can disagree"],
        correctIndex: 0,
        why: "You can disagree and request changes.",
      },
    ],
    discipline: [
      {
        question: "What does the school want to do first?",
        options: ["Meet you before deciding", "Suspend immediately", "Call the police"],
        correctIndex: 0,
        why: "A conference is scheduled before any decision.",
      },
      {
        question: "Does your child get to tell their side?",
        options: ["Yes, that is their right", "No", "Only with a lawyer"],
        correctIndex: 0,
        why: "Your child has the right to be heard.",
      },
      {
        question: "Can you appeal the decision?",
        options: ["Yes, in writing", "No", "Only teachers can appeal"],
        correctIndex: 0,
        why: "You can appeal in writing.",
      },
    ],
    generic: [
      {
        question: "What is this letter mainly about?",
        options: ["Information from the school", "A bill", "A bus schedule"],
        correctIndex: 0,
        why: "It is an informational letter.",
      },
      {
        question: "Do you need to sign anything?",
        options: ["No", "Yes, two forms", "Yes, and pay a fee"],
        correctIndex: 0,
        why: "No signature is required.",
      },
      {
        question: "Who can you contact with questions?",
        options: ["The school office", "Nobody", "Only the district"],
        correctIndex: 0,
        why: "The office contact is listed in the letter.",
      },
    ],
  };
  return sets[type] ?? sets.generic;
}

export function mockExplain(letterText: string): AnalyzeOutput {
  const t = letterText.toLowerCase();
  const type = t.includes("consent")
    ? "consent"
    : t.includes("iep") || t.includes("individualized education")
      ? "iep"
      : t.includes("suspension") || t.includes("discipline") || t.includes("incident")
        ? "discipline"
        : "generic";
  return {
    analysis: ANALYSIS_BY_TYPE[type] ?? ANALYSIS_BY_TYPE.generic,
    explanation: explanationFor(type),
    questions: quizFor(type),
  };
}

export function mockSimplify(type: string, failedQuestions: string[]): { headline: string; bullets: string[]; aboutWrong: string[] } {
  const headlines: Record<string, string> = {
    consent: "Take a breath. It is simpler than it looks.",
    iep: "Take a breath. It is a meeting invitation.",
    discipline: "Take a breath. Nobody has decided anything yet.",
    generic: "Take a breath. This is only information.",
  };
  const bullets: Record<string, string[]> = {
    consent: [
      "The school wants to test how your child learns.",
      "The test happens during school hours.",
      "You choose. Yes now, questions first, or no.",
    ],
    iep: ["The school invites you to a meeting.", "At the meeting you help make the plan.", "You can bring an interpreter. It is free."],
    discipline: ["Something happened at school.", "They want to meet you first.", "Nothing is decided yet."],
    generic: ["The school is sharing information.", "You do not need to do anything today."],
  };
  const about = failedQuestions.map((q) => `About "${q.slice(0, 60)}": the answer is in the letter, and it is okay to read it again with the school.`);
  return { headline: headlines[type] ?? headlines.generic, bullets: bullets[type] ?? bullets.generic, aboutWrong: about };
}
