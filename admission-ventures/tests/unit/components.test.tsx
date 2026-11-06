import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamTimer } from "../../src/features/examinations/ExamTimer";
import { Pagination, EmptyState, ErrorState, AsyncView } from "../../src/components/ui";
import { useCountdown } from "../../src/hooks/useCountdown";
import { checkoutKey, clearCheckoutKey } from "../../src/utils/idempotency";

describe("ExamTimer", () => {
  it("shows the clock and changes tone near the end", () => {
    const { rerender, container } = render(<ExamTimer secondsLeft={900} />);
    expect(screen.getByLabelText(/Time left 15:00/)).toBeInTheDocument();
    expect(container.innerHTML).toContain("bg-brand-800");
    rerender(<ExamTimer secondsLeft={200} />);
    expect(container.innerHTML).toContain("bg-amber");
    rerender(<ExamTimer secondsLeft={30} />);
    expect(container.innerHTML).toContain("bg-red-700");
  });
  it("announces the five- and one-minute warnings", () => {
    const { rerender } = render(<ExamTimer secondsLeft={300} />);
    expect(screen.getByRole("status")).toHaveTextContent("Five minutes remaining.");
    rerender(<ExamTimer secondsLeft={60} />);
    expect(screen.getByRole("status")).toHaveTextContent("One minute remaining.");
  });
});

describe("useCountdown", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("counts down using the SERVER clock, not the device clock", () => {
    // Device clock is 10 minutes ahead of the server; the server says 120 s remain.
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const { result } = renderHook(() => useCountdown("2026-01-01T00:02:00Z", "2026-01-01T00:00:00Z"));
    expect(result.current).toBe(120);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current).toBe(90);
    act(() => { vi.advanceTimersByTime(200_000); });
    expect(result.current).toBe(0);
  });
});

describe("shared states", () => {
  it("paginates", () => {
    const onPage = vi.fn();
    render(<Pagination page={0} pageSize={10} total={25} onPage={onPage} />);
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeDisabled();
    screen.getByText("Next").click();
    expect(onPage).toHaveBeenCalledWith(1);
  });
  it("hides pagination for one page", () => {
    const { container } = render(<Pagination page={0} pageSize={10} total={5} onPage={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("renders loading, error, empty and data states", () => {
    const base = { reload: vi.fn() };
    const { rerender } = render(<AsyncView state={{ ...base, data: undefined, error: undefined, loading: true }}>{() => <p>data</p>}</AsyncView>);
    expect(screen.getByRole("status")).toHaveTextContent(/Loading/);
    rerender(<AsyncView state={{ ...base, data: undefined, error: new Error("x"), loading: false }}>{() => <p>data</p>}</AsyncView>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<AsyncView state={{ ...base, data: [], error: undefined, loading: false }} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Nothing here" />}>{() => <p>data</p>}</AsyncView>);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    rerender(<AsyncView state={{ ...base, data: [1], error: undefined, loading: false }} isEmpty={(d) => d.length === 0}>{() => <p>data</p>}</AsyncView>);
    expect(screen.getByText("data")).toBeInTheDocument();
  });
  it("offers retry on errors", () => {
    const retry = vi.fn();
    render(<MemoryRouter><ErrorState error={new Error("x")} onRetry={retry} /></MemoryRouter>);
    screen.getByText("Try again").click();
    expect(retry).toHaveBeenCalled();
  });
});

describe("checkout idempotency key", () => {
  it("is stable per course until cleared (double-click and reload safe)", () => {
    sessionStorage.clear();
    const a = checkoutKey("course-1");
    expect(checkoutKey("course-1")).toBe(a);
    expect(checkoutKey("course-2")).not.toBe(a);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    clearCheckoutKey("course-1");
    expect(checkoutKey("course-1")).not.toBe(a);
  });
});
