import { AxiosError } from "axios";

export const extractErrorMessage = (
  error: unknown,
  fallback: string = "Something went wrong"
) => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;

  const axiosError = error as AxiosError<any>;
  const data = axiosError?.response?.data;
  if (data) {
    // StandardResponse-style error: { error: { message } }
    if (typeof data.error?.message === "string" && data.error.message.trim()) {
      return data.error.message;
    }
    // Legacy: { error: "string" }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
    // Middleware validation: { errors: [{ message }] }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const messages = data.errors
        .map((e: any) => (typeof e?.message === "string" ? e.message.trim() : ""))
        .filter((m: string) => m.length > 0);
      if (messages.length) {
        return messages.join(", ");
      }
    }
    // StandardResponse success=false message: { message: string | string[] }
    if (data.message) {
      return Array.isArray(data.message)
        ? data.message.join(", ")
        : String(data.message);
    }
  }

  return fallback;
};
