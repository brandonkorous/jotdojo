export {
  PROMPT, STRUCTURE_MARKER, RecognitionError, parseReading, readWith,
  anthropicRecognizer, openAiRecognizer, fakeRecognizer,
  type Page, type Reading, type Recognizer,
} from "./provider";
export { resolveRecognizer, recognizer } from "./resolve";
export * from "./structure";
