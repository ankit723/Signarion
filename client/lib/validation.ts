/** Tiny form validators. Each returns an error string, or undefined when valid. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const checkEmail = (value: string): string | undefined => {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
};

export const checkPassword = (value: string): string | undefined => {
  if (!value) return "Enter your password.";
};

export const checkNewPassword = (value: string): string | undefined => {
  if (!value) return "Choose a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return "Include at least one letter and one number.";
  }
};

export const checkConfirm = (password: string, confirm: string): string | undefined => {
  if (!confirm) return "Re-enter your password.";
  if (password !== confirm) return "Passwords don't match.";
};

export const checkName = (value: string): string | undefined => {
  const name = value.trim();
  if (!name) return "Enter your name.";
  if (name.length < 2) return "That name is too short.";
};
