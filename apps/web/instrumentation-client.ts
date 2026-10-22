import { installReactHook } from "@wizeworks/lens-react";
import { serverTraces } from "./components/WizeLens";

/**
 * Runs before the app hydrates, the one place that lands ahead of react-dom.
 * WizeLens times each render per component, only when this page's server traces it.
 */
if (serverTraces()) {
  installReactHook();
}
