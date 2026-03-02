import { AxiosError } from "axios";

const normalizeMessage = (
  message: string,
  fallback: string
): string | null => {
  const cleaned = message
    .replace(/^axioserror:\s*/i, "")
    .replace(/^error:\s*/i, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const lower = cleaned.toLowerCase();
  if (lower.includes("request failed with status code")) {
    return null;
  }

  if (
    lower.includes("payment_required") ||
    lower.includes("paid_plan_required") ||
    lower.includes("billing")
  ) {
    return "Examiner voice is temporarily unavailable. The app will use device voice instead.";
  }

  if (lower.includes("network error")) {
    return "Connection issue detected. Please check your internet and try again.";
  }

  if (lower.includes("timeout")) {
    return "The request took too long. Please try again.";
  }

  if (cleaned.length <= 200) {
    return cleaned;
  }

  return fallback;
};

export const extractErrorMessage = (
  error: unknown,
  fallback: string = "Something went wrong"
) => {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const axiosError = error as AxiosError<any>;
  const status = axiosError?.response?.status;
  const data = axiosError?.response?.data;
  if (data) {
    if (data.error?.message) {
      return normalizeMessage(data.error.message, fallback) || fallback;
    }
    if (data.message)
      return normalizeMessage(
        Array.isArray(data.message)
        ? data.message.join(", ")
          : data.message,
        fallback
      ) || fallback;
  }

  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to do this.";
  }

  if (status === 429) {
    return "You're doing that too frequently. Please wait a moment and retry.";
  }

  if (status && status >= 500) {
    return "Service is temporarily unavailable. Please try again.";
  }

  if (axiosError?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (error instanceof Error && error.message) {
    return normalizeMessage(error.message, fallback) || fallback;
  }

  return fallback;
};
