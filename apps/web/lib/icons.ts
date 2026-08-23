import type { IconDefinition } from "@awesome.me/kit-2fb7fafdba/icons";

export type { IconDefinition };
import {
  faAngleDown, faArrowDownToBracket, faArrowPointer, faBold, faCamera,
  faCirclePlus, faComment, faItalic, faKeyboard, faMagnifyingGlass, faMinus,
  faMicrophone, faPaintbrush, faPenLine, faPlus, faSparkles,
  faText, faTrash, faUnderline, faXmark,
} from "@awesome.me/kit-2fb7fafdba/icons/whiteboard/semibold";

/**
 * Every icon in the product, in one place. ADR-083.
 *
 * Font Awesome Whiteboard Semibold, which is marker-drawn -- and the reason it
 * is a map rather than free imports is that the family does not cover
 * everything, so the substitutions have to be visible in one list instead of
 * scattered across nine components.
 *
 * Keys are named for the JOB, not for the picture. `remove` rather than `trash`
 * means swapping the artwork never means editing a caller.
 */
export const ICONS = {
  /* the ink tools */
  text: faText,
  pen: faPenLine,
  /** No `highlighter` in Whiteboard. A brush is the closest broad stroke. */
  highlighter: faPaintbrush,
  /** No `eraser` in Whiteboard. A slashed brush read as "highlighter off"
   *  beside the highlighter; rubbing out and throwing away are the same idea,
   *  and they never appear side by side. */
  eraser: faTrash,
  /** No `lasso`. The select-cursor is the honest stand-in. */
  select: faArrowPointer,
  voice: faMicrophone,
  photo: faCamera,
  keyboard: faKeyboard,

  /* chrome */
  search: faMagnifyingGlass,
  download: faArrowDownToBracket,
  remove: faTrash,
  zoomIn: faPlus,
  zoomOut: faMinus,
  agent: faSparkles,
  remarks: faComment,
  collapse: faAngleDown,
  close: faXmark,
  addBox: faCirclePlus,

  /* text marks */
  bold: faBold,
  italic: faItalic,
  underline: faUnderline,
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

/** The three the Whiteboard family has no glyph for. docs/10-design-system.md. */
export const SUBSTITUTED: IconName[] = ["highlighter", "eraser", "select"];
