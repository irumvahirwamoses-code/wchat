/**
 * Username helpers shared by the auth controller and user controller.
 *
 * Wchat usernames are plain handles: 3–20 characters, lowercase letters,
 * numbers, dots and underscores. This intentionally drops the old mandatory
 * '#' prefix; '@' is only a display affordance.
 */

export const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Strip decorations/spaces and lowercase a raw username input. */
export const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[@#]+/, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, USERNAME_MAX);

export const isValidUsername = (value) => USERNAME_REGEX.test(String(value || ''));

/** Ugly-but-useful guard so suggestions never start with a dot/underscore. */
const tidy = (value) => normalizeUsername(value).replace(/^[._]+|[._]+$/g, '');

/**
 * Propose usernames derived from a person's name.
 * The controller filters this list against the database.
 */
export const buildUsernameSuggestions = (firstName = '', lastName = '') => {
  const first = tidy(firstName);
  const last = tidy(lastName);
  const firstInitial = first.slice(0, 1);

  const candidates = [
    `${first}${last}`,
    `${first}.${last}`,
    `${first}_${last}`,
    `${first}${last.slice(0, 1)}`,
    `${first}${last}.rw`,
    `${last}${first}`,
    `${first}${firstInitial}${last.slice(0, 2)}`,
    `${first}${new Date().getFullYear().toString().slice(2)}`,
    `${first}${last}${Math.floor(10 + Math.random() * 89)}`,
    `${first}${Math.floor(100 + Math.random() * 899)}`,
  ]
    .map(tidy)
    .filter((candidate) => candidate.length >= USERNAME_MIN);

  const unique = [...new Set(candidates)];

  // Top up with random digits if the name produced too few candidates.
  let counter = 1;
  while (unique.length < 8 && first) {
    const extra = tidy(`${first}${last}${counter}`);
    if (extra.length >= USERNAME_MIN && !unique.includes(extra)) unique.push(extra);
    counter += 1;
    if (counter > 50) break;
  }

  return unique.slice(0, 10);
};

export default {
  USERNAME_REGEX,
  USERNAME_MIN,
  USERNAME_MAX,
  normalizeUsername,
  isValidUsername,
  buildUsernameSuggestions,
};
