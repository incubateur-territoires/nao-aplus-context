import { isValidRegistrationNumber } from "./registration-number";

describe("isValidRegistrationNumber", () => {
  it.each(["0", "42", "1234", "999999"])("accepte %s", (value) => {
    expect(isValidRegistrationNumber(value)).toBe(true);
  });

  it.each(["", "ab", "12a", "-", "12 34", "1234567"])(
    "refuse « %s »",
    (value) => {
      expect(isValidRegistrationNumber(value)).toBe(false);
    },
  );
});
