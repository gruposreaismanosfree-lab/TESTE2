export type ExitShortcutPreference = { enabled: boolean; key: 'F8' | 'F9' };

export const EXIT_SHORTCUT_METADATA_KEY = 'ws_exit_shortcut';
export const EXIT_SHORTCUT_REFRESH_MS = 30000;

export function readExitShortcut(value: unknown): ExitShortcutPreference {
  if (!value || typeof value !== 'object') return { enabled: false, key: 'F8' };
  const record = value as Record<string, unknown>;
  const validKey = record.key === 'F8' || record.key === 'F9';
  return {
    enabled: validKey && record.enabled === true,
    key: record.key === 'F9' ? 'F9' : 'F8',
  };
}

type KeyInput = {
  key: string;
  repeat: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export function matchesExitShortcut(event: KeyInput, preference: ExitShortcutPreference, editing: boolean): boolean {
  return preference.enabled && !editing && event.key === preference.key
    && !event.repeat && !event.defaultPrevented && !event.isComposing
    && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

export function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    'input, textarea, select, form, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"], .monaco-editor, .cm-editor, .CodeMirror, [data-ws-shortcuts="off"]',
  ));
}
