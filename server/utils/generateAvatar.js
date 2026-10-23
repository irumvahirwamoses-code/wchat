/**
 * Deterministic avatar + username helpers (Wchat branded).
 *
 * Avatars are generated with DiceBear (real, deterministic SVG avatars) so a
 * user always gets the *same* picture for the same seed. At registration the
 * avatar is chosen to match the user's gender; the user can upload a photo
 * later from their profile.
 */

/** DiceBear style per gender. */
const GENDER_STYLE = {
  male: 'adventurer',
  female: 'avataaars',
  other: 'notionists',
  'prefer-not-to-say': 'thumbs',
};

// Wchat palette (hex without '#') used as avatar backgrounds.
const Wchat_BACKGROUNDS = '245bff,24145b,f3f5fa,e8ecff';

/**
 * Build a DiceBear avatar URL for a given seed.
 *
 * @param {string} seed  Seed used to generate a deterministic avatar.
 * @param {string} style DiceBear style (e.g. 'avataaars', 'identicon').
 * @returns {string} Fully qualified DiceBear SVG URL.
 */
export const generateAvatar = (seed = 'wchat', style = 'notionists') => {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(
    String(seed)
  )}&backgroundColor=${Wchat_BACKGROUNDS}&radius=50`;
};

/** Avatar that matches the user's gender (falls back to neutral). */
export const generateGenderAvatar = (seed = 'wchat', gender = 'prefer-not-to-say') => {
  const style = GENDER_STYLE[gender] || GENDER_STYLE['prefer-not-to-say'];
  return generateAvatar(seed, style);
};

/** Convenience helper for Circles (groups). */
export const generateGroupAvatar = (seed) => generateAvatar(seed, 'shapes');

export default generateAvatar;
