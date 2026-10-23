/**
 * Wchat interest taxonomy.
 *
 * These are the "fields" a user picks during onboarding (minimum 5). They power
 * Circle recommendations, feed ranking and discovery. Each entry has a stable
 * `id` (stored in the database) and a human label plus emoji for the UI.
 *
 * Rwanda-first: the list mixes global interests with fields that matter locally
 * (agriculture, moto-taxi, ibimina savings groups, agaseke handcrafts, ...).
 */

export const INTERESTS = [
  // --- Work & money -----------------------------------------------------
  { id: 'agriculture', label: 'Agriculture', emoji: '🌱', category: 'work' },
  { id: 'livestock', label: 'Livestock', emoji: '🐄', category: 'work' },
  { id: 'coffee-tea', label: 'Coffee & Tea', emoji: '☕', category: 'work' },
  { id: 'business', label: 'Business', emoji: '💼', category: 'work' },
  { id: 'entrepreneurship', label: 'Entrepreneurship', emoji: '🚀', category: 'work' },
  { id: 'fintech', label: 'Fintech & Mobile Money', emoji: '📱', category: 'work' },
  { id: 'jobs', label: 'Jobs & Internships', emoji: '🧑‍💼', category: 'work' },
  { id: 'marketplace', label: 'Marketplace', emoji: '🛒', category: 'work' },
  { id: 'savings-groups', label: 'Savings Groups (Ibimina)', emoji: '🤝', category: 'work' },
  { id: 'construction', label: 'Construction', emoji: '🏗️', category: 'work' },
  { id: 'real-estate', label: 'Real Estate', emoji: '🏠', category: 'work' },
  { id: 'transport', label: 'Transport & Moto-taxi', emoji: '🏍️', category: 'work' },
  { id: 'mining', label: 'Mining', emoji: '⛏️', category: 'work' },
  { id: 'fishing', label: 'Fishing', emoji: '🎣', category: 'work' },

  // --- Knowledge --------------------------------------------------------
  { id: 'technology', label: 'Technology', emoji: '💻', category: 'knowledge' },
  { id: 'education', label: 'Education', emoji: '🎓', category: 'knowledge' },
  { id: 'science', label: 'Science', emoji: '🔬', category: 'knowledge' },
  { id: 'health', label: 'Health', emoji: '🩺', category: 'knowledge' },
  { id: 'languages', label: 'Languages', emoji: '🗣️', category: 'knowledge' },
  { id: 'news', label: 'News & Media', emoji: '📰', category: 'knowledge' },
  { id: 'government', label: 'Government & Public Services', emoji: '🏛️', category: 'knowledge' },
  { id: 'ngos', label: 'NGOs & Development', emoji: '🌍', category: 'knowledge' },

  // --- Culture & creativity --------------------------------------------
  { id: 'music', label: 'Music', emoji: '🎵', category: 'culture' },
  { id: 'dance', label: 'Dance & Intore', emoji: '💃', category: 'culture' },
  { id: 'art', label: 'Art', emoji: '🎨', category: 'culture' },
  { id: 'handcrafts', label: 'Handcrafts (Agaseke)', emoji: '🧺', category: 'culture' },
  { id: 'comedy', label: 'Comedy', emoji: '😂', category: 'culture' },
  { id: 'movies', label: 'Movies & Series', emoji: '🎬', category: 'culture' },
  { id: 'photography', label: 'Photography', emoji: '📷', category: 'culture' },
  { id: 'fashion', label: 'Fashion & Tailoring', emoji: '👗', category: 'culture' },
  { id: 'beauty', label: 'Hair & Beauty', emoji: '💅', category: 'culture' },
  { id: 'cooking', label: 'Food & Cooking', emoji: '🍲', category: 'culture' },
  { id: 'faith', label: 'Faith & Religion', emoji: '🙏', category: 'culture' },
  { id: 'lifestyle', label: 'Lifestyle', emoji: '✨', category: 'culture' },
  { id: 'family', label: 'Family & Parenting', emoji: '👨‍👩‍👧', category: 'culture' },

  // --- Play -------------------------------------------------------------
  { id: 'football', label: 'Football', emoji: '⚽', category: 'play' },
  { id: 'basketball', label: 'Basketball', emoji: '🏀', category: 'play' },
  { id: 'volleyball', label: 'Volleyball', emoji: '🏐', category: 'play' },
  { id: 'athletics', label: 'Athletics & Running', emoji: '🏃', category: 'play' },
  { id: 'fitness', label: 'Fitness & Gym', emoji: '💪', category: 'play' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮', category: 'play' },
  { id: 'travel', label: 'Travel & Tourism', emoji: '✈️', category: 'play' },
  { id: 'nature', label: 'Nature & Environment', emoji: '🌿', category: 'play' },
];

export const INTEREST_IDS = INTERESTS.map((interest) => interest.id);

export const INTEREST_CATEGORIES = [
  { id: 'work', label: 'Work & Money' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'culture', label: 'Culture & Creativity' },
  { id: 'play', label: 'Play & Lifestyle' },
];

export const MIN_INTERESTS = 5;
export const MIN_JOINED_CIRCLES = 5;

export default { INTERESTS, INTEREST_IDS, INTEREST_CATEGORIES, MIN_INTERESTS, MIN_JOINED_CIRCLES };
