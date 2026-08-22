export {
  PROMPT, RecognitionError, parseReading,
  anthropicRecognizer, openAiRecognizer, fakeRecognizer,
  type Page, type Reading, type Recognizer,
} from "./provider";
export { resolveRecognizer, recognizer } from "./resolve";
