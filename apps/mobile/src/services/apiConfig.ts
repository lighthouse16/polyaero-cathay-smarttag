import { Platform } from "react-native";

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const defaultUrl =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000/api/v1"
    : "http://localhost:8000/api/v1";

export const API_BASE_URL = (configuredUrl || defaultUrl).replace(/\/+$/, "");
export const USE_MOCK_DATA = process.env.EXPO_PUBLIC_USE_MOCK_DATA === "true";

const url = new URL(API_BASE_URL);
if (
  !["http:", "https:"].includes(url.protocol) ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
) {
  throw new Error(
    "EXPO_PUBLIC_API_URL must be an HTTP(S) API URL without credentials, query, or fragment.",
  );
}
