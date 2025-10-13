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
    if (data.error?.message) return data.error.message;
    if (data.message)
      return Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message;
  }

  return fallback;
};
