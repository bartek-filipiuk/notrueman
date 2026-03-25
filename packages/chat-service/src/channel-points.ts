/**
 * Channel Points reward handlers.
 * Rewards: "Change weather", "Send letter"
 */
import type { ViewerEvent } from "@nts/shared";

export type RewardType = "change_weather" | "send_letter";

export interface RewardHandler {
  type: RewardType;
  handle(userId: string, displayName: string, input: string): RewardResult;
}

export interface RewardResult {
  accepted: boolean;
  message: string;
  event?: ViewerEvent;
}

const WEATHER_OPTIONS = ["sunny", "cloudy", "rainy", "stormy", "snowy", "foggy"] as const;
export type WeatherOption = (typeof WEATHER_OPTIONS)[number];

/** "Change weather" — viewer picks a weather condition. */
export function handleWeatherChange(
  userId: string,
  displayName: string,
  input: string,
): RewardResult {
  const normalized = input.toLowerCase().trim();
  const weather = WEATHER_OPTIONS.find((w) => normalized.includes(w));

  if (!weather) {
    return {
      accepted: false,
      message: `Invalid weather! Choose from: ${WEATHER_OPTIONS.join(", ")}`,
    };
  }

  const event: ViewerEvent = {
    id: `cp-weather-${Date.now()}-${userId}`,
    platform: "twitch",
    type: "channel_points",
    userId,
    displayName,
    content: weather,
    metadata: { rewardType: "change_weather", weather },
    timestamp: new Date(),
  };

  return {
    accepted: true,
    message: `${displayName} changed the weather to ${weather}! ☁️`,
    event,
  };
}

/** "Send letter" — viewer sends a message to Truman. */
export function handleSendLetter(
  userId: string,
  displayName: string,
  input: string,
): RewardResult {
  const trimmed = input.trim();

  if (trimmed.length < 5) {
    return {
      accepted: false,
      message: "Letter is too short! Write at least 5 characters.",
    };
  }

  if (trimmed.length > 200) {
    return {
      accepted: false,
      message: "Letter is too long! Maximum 200 characters.",
    };
  }

  const event: ViewerEvent = {
    id: `cp-letter-${Date.now()}-${userId}`,
    platform: "twitch",
    type: "letter",
    userId,
    displayName,
    content: trimmed,
    metadata: { rewardType: "send_letter" },
    timestamp: new Date(),
  };

  return {
    accepted: true,
    message: `${displayName} sent a letter to Truman! 💌`,
    event,
  };
}

/** Dispatch a channel points redemption by reward title. */
export function dispatchReward(
  rewardTitle: string,
  userId: string,
  displayName: string,
  input: string,
): RewardResult | null {
  const normalized = rewardTitle.toLowerCase();

  if (normalized.includes("weather")) {
    return handleWeatherChange(userId, displayName, input);
  }
  if (normalized.includes("letter")) {
    return handleSendLetter(userId, displayName, input);
  }

  return null;
}
