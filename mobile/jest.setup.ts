import "@testing-library/jest-native/extend-expect";

if (typeof (global as { __DEV__?: boolean }).__DEV__ === "undefined") {
  (global as { __DEV__?: boolean }).__DEV__ = false;
}
