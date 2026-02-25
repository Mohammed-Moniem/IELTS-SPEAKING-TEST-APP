import { extractErrorMessage } from "./errors";

describe("extractErrorMessage", () => {
  it("returns session-expired message for 401 responses", () => {
    const result = extractErrorMessage({
      response: { status: 401 },
    });

    expect(result).toBe("Your session expired. Please sign in again.");
  });

  it("maps billing/provider outages to device-voice fallback message", () => {
    const result = extractErrorMessage({
      response: {
        data: {
          message: "billing provider unavailable",
        },
      },
    });

    expect(result).toBe(
      "Examiner voice is temporarily unavailable. The app will use device voice instead."
    );
  });

  it("returns clean network message for network errors", () => {
    const result = extractErrorMessage(new Error("Network Error"));
    expect(result).toBe(
      "Connection issue detected. Please check your internet and try again."
    );
  });

  it("falls back to generic message when payload is malformed", () => {
    const result = extractErrorMessage({ foo: "bar" }, "Default message");
    expect(result).toBe("Default message");
  });
});
