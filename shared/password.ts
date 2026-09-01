/**
 * One password policy, shared by the server (enforcement) and the client
 * (live feedback as you type). Previously every flow only checked a length —
 * `admin.setPassword` allowed 6 characters, everything else 8 — so "password"
 * and "12345678" were both accepted, including on the set-your-first-password
 * flow that most migrated Bubble users go through.
 *
 * Deliberately modest: length plus a letter and a number. Long is what actually
 * matters, and stacking symbol/case rules pushes people toward "Passw0rd!" and
 * a sticky note rather than a better secret.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt silently truncates beyond 72 bytes, so refuse rather than mislead. */
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

/** The most-guessed passwords, plus the ones this product invites by name. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789",
  "1234567890", "qwertyui", "qwerty123", "11111111", "00000000", "abc12345",
  "iloveyou", "welcome1", "letmein1", "admin123", "sunshine", "princess",
  "football", "baseball", "trustno1", "dragon123", "monkey123",
  "artswrk", "artswrk1", "artswrk123", "dance123", "dancer123",
]);

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letter",
    label: "Contains a letter",
    test: (p) => /[a-zA-Z]/.test(p),
  },
  {
    id: "number",
    label: "Contains a number",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "notCommon",
    label: "Not a commonly used password",
    test: (p) => !COMMON_PASSWORDS.has(p.trim().toLowerCase()),
  },
];

/** Every rule the given password fails, in display order. Empty = valid. */
export function getPasswordFailures(password: string): PasswordRule[] {
  if (password.length > PASSWORD_MAX_LENGTH) {
    return [{
      id: "maxLength",
      label: `At most ${PASSWORD_MAX_LENGTH} characters`,
      test: () => false,
    }];
  }
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

export function isPasswordValid(password: string): boolean {
  return getPasswordFailures(password).length === 0;
}

/** Single-sentence reason for the first failed rule — for API error messages. */
export function getPasswordError(password: string): string | null {
  const [first] = getPasswordFailures(password);
  if (!first) return null;
  if (first.id === "notCommon") return "That password is too common — please choose something harder to guess.";
  if (first.id === "maxLength") return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  return `Password must be ${PASSWORD_RULES.map((r) => r.label.toLowerCase()).join(", ")}.`;
}
