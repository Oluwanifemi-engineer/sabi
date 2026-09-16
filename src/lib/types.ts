export type LetterType = "consent" | "iep" | "discipline" | "meeting" | "generic";

export type Urgency = "action-required" | "response-needed-by" | "fyi";

export interface Letter {
  id: string;
  createdAt: number;
  sourceName: string;
  parentLanguage: LanguageCode;
  rawText: string;
}

export interface Analysis {
  type: LetterType;
  urgency: Urgency;
  deadline?: string;
  actions: string[];
  keyFacts: string[];
  risksOfSigning: string[];
  rights: string[];
}

export interface Explanation {
  headline: string;
  summary: string;
  whatTheyAsk: string;
  ifYouSign: string;
  ifYouDontSign: string;
  simpler?: string;
  questionsToAsk: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  why: string;
}

export interface QuizResult {
  passed: boolean;
  attempts: number;
  wrong: number[];
}

export interface Acknowledgment {
  signedAt: number;
  signatureDataUrl: string;
  language: LanguageCode;
  quizPassed: boolean;
  quizAttempts: number;
  replyText: string;
}

export type LanguageCode = "es" | "fr" | "pt" | "ar" | "en";

export const LANGUAGES: { code: LanguageCode; label: string; native: string; tts: string; rtl?: boolean }[] = [
  { code: "es", label: "Spanish", native: "Español", tts: "es-ES" },
  { code: "fr", label: "French", native: "Français", tts: "fr-FR" },
  { code: "pt", label: "Portuguese", native: "Português", tts: "pt-PT" },
  { code: "ar", label: "Arabic", native: "العربية", tts: "ar-SA", rtl: true },
  { code: "en", label: "English", native: "English", tts: "en-US" },
];

export interface LetterRecord extends Letter {
  status: "explained" | "quiz" | "signed";
  analysis?: Analysis;
  explanation?: Explanation;
  quiz?: QuizQuestion[];
  quizResult?: QuizResult;
  acknowledgment?: Acknowledgment;
}
