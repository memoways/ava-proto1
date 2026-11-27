import { useUnsavedChanges, type UnsavedSection as Section } from "./context";

/** Hook form for lists: one draft per rendered item. */
export function UnsavedSection(section: Section) {
  useUnsavedChanges(section);
  return null;
}
