/** 5 core personality traits (agent-spec.md S3.2) */
export interface PersonalityState {
  introspection: number; // 0.0-1.0: How reflective/philosophical
  sociability: number; // 0.0-1.0: How outgoing in monologue style
  creativity: number; // 0.0-1.0: How creative/artistic
  skepticism: number; // 0.0-1.0: How questioning (tied to awakening)
  confidence: number; // 0.0-1.0: Self-assurance in actions

  recentInfluences: PersonalityInfluence[];
}

export interface PersonalityInfluence {
  activity: string; // e.g., "reading_philosophy"
  weight: number; // Recency-weighted impact
  effect: string; // e.g., "more_contemplative"
}

/** Preferences evolve from experience (design-spec.md S4.1) */
export interface Preferences {
  favoriteActivities: string[];
  dislikedActivities: string[];
  favoriteBooks: string[];
  favoriteFoods: string[];
  currentInterests: string[];
}
