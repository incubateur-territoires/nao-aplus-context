import { renderHook, act } from "@testing-library/react";
import { useMinimumDuration } from "./use-minimum-duration";

const MINIMUM_MS = 1000;

describe("useMinimumDuration", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reste actif jusqu'à la durée minimale quand l'état retombe trop vite", () => {
    const { result, rerender } = renderHook(
      ({ isActive }) => useMinimumDuration(isActive, MINIMUM_MS),
      { initialProps: { isActive: true } },
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender({ isActive: false });

    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe(false);
  });

  it("retombe immédiatement quand la durée minimale est déjà écoulée", () => {
    const { result, rerender } = renderHook(
      ({ isActive }) => useMinimumDuration(isActive, MINIMUM_MS),
      { initialProps: { isActive: true } },
    );

    act(() => {
      jest.advanceTimersByTime(MINIMUM_MS + 1);
    });
    rerender({ isActive: false });

    expect(result.current).toBe(false);
  });

  it("reste inactif quand l'état ne l'a jamais été", () => {
    const { result } = renderHook(() => useMinimumDuration(false, MINIMUM_MS));

    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(MINIMUM_MS);
    });
    expect(result.current).toBe(false);
  });

  it("repart pour une durée complète à chaque réactivation", () => {
    const { result, rerender } = renderHook(
      ({ isActive }) => useMinimumDuration(isActive, MINIMUM_MS),
      { initialProps: { isActive: true } },
    );

    rerender({ isActive: false });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    rerender({ isActive: true });
    rerender({ isActive: false });

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);
  });
});
