/**
 * Wchat starter Circles.
 *
 * These public Circles are created by the seed script so that a brand-new user
 * always has something relevant to join during onboarding ("Join at least 5").
 * Each Circle is idempotently upserted by `chatName`, so re-running the seed is
 * safe. `category` must be one of the values in data/categories.js and every
 * `interest` must exist in data/interests.js.
 */

export const STARTER_CIRCLES = [
  {
    chatName: 'Technology Rwanda',
    category: 'technology',
    interests: ['technology', 'fintech', 'science'],
    description:
      'Rwandan builders, gadgets and the future of tech. Share what you are working on.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Startup & Business Hub',
    category: 'business',
    interests: ['business', 'entrepreneurship', 'jobs'],
    description: 'Ideas, funding, customers and hiring for founders and hustlers.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Agriculture & Farming',
    category: 'general',
    interests: ['agriculture', 'livestock', 'coffee-tea'],
    description: 'From the hills to the market — crops, livestock and coffee prices.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Ibimina & Savings',
    category: 'business',
    interests: ['savings-groups', 'fintech', 'business'],
    description: 'Digital ibimina, saving circles and money tips for our community.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Marketplace Rwanda',
    category: 'business',
    interests: ['marketplace', 'business', 'handcrafts'],
    description: 'Buy and sell: products, services, agaseke and everything in between.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Motors & Moto-taxi',
    category: 'general',
    interests: ['transport', 'construction', 'real-estate'],
    description: 'Transport, moto-taxi, driving and construction talk.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Music & Comedy Rwanda',
    category: 'music',
    interests: ['music', 'dance', 'comedy'],
    description: 'New releases, Intore dance and the jokes that carry the group.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Football Fans Rwanda',
    category: 'sports',
    interests: ['football', 'athletics', 'fitness'],
    description: 'Amavubi, APR, big matches and everything sports.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Health & Wellness',
    category: 'lifestyle',
    interests: ['health', 'fitness', 'lifestyle'],
    description: 'Healthy living, mental health and staying fit.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Coding & Tech Careers',
    category: 'technology',
    interests: ['technology', 'education', 'jobs'],
    description: 'Learn to code, find a mentor, land your first tech job.',
    joinPolicy: 'request',
  },
  {
    chatName: 'Kigali Creatives',
    category: 'art',
    interests: ['art', 'photography', 'fashion', 'handcrafts'],
    description: 'Designers, photographers, artists and makers in the city.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Food & Cooking Rwanda',
    category: 'lifestyle',
    interests: ['cooking', 'lifestyle', 'family'],
    description: 'Recipes, restaurants and the best of Rwandan food.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Faith & Family',
    category: 'general',
    interests: ['faith', 'family', 'lifestyle'],
    description: 'Faith, family and community values.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Travel & Nature Rwanda',
    category: 'general',
    interests: ['travel', 'nature', 'photography'],
    description: 'Explore the land of a thousand hills together.',
    joinPolicy: 'open',
  },
  {
    chatName: 'News & Government',
    category: 'education',
    interests: ['news', 'government', 'ngos'],
    description: 'Civic life, public services, development and current affairs.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Gaming Arena',
    category: 'gaming',
    interests: ['gaming', 'technology', 'comedy'],
    description: 'Mobile and console gaming, tournaments and squads.',
    joinPolicy: 'open',
  },
  {
    chatName: 'Kigali · Local',
    category: 'general',
    interests: ['news', 'lifestyle', 'jobs'],
    description: 'What is happening around Kigali right now.',
    joinPolicy: 'open',
    circleType: 'local',
    district: 'Kigali',
  },
];

export default STARTER_CIRCLES;
