import { describe, expect, it } from "vitest";
import { formatBDT, formatClock, formatDuration, formatScore, fromLocalInput, parseYouTubeId, slugify, toLocalInput } from "../../src/utils/format";
import { bdPhone, courseSchema, grantSchema, newPasswordSchema, questionSchema, registerSchema } from "../../src/lib/validation/schemas";
import { errorMessage } from "../../src/utils/messages";
import { ApiError } from "../../src/lib/supabase/functions";

describe("formatters", () => {
  it("formats money, time and scores", () => {
    expect(formatBDT(0)).toBe("Free");
    expect(formatBDT(1490)).toBe("৳1,490");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(3900)).toBe("1h 5m");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("00:00");
    expect(formatScore(1.75)).toBe("1.75");
    expect(formatScore(2)).toBe("2");
    expect(formatScore(null)).toBe("—");
  });
  it("slugifies", () => { expect(slugify("  Second Timer: Arts (2026)! ")).toBe("second-timer-arts-2026"); });
  it("extracts YouTube ids safely", () => {
    expect(parseYouTubeId("jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
    expect(parseYouTubeId("https://youtu.be/jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
    expect(parseYouTubeId("https://www.youtube.com/watch?v=jNQXAC9IVRw&t=4")).toBe("jNQXAC9IVRw");
    expect(parseYouTubeId("https://www.youtube.com/embed/jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
    expect(parseYouTubeId("https://evil.example/watch?v=jNQXAC9IVRw")).toBeNull();
    expect(parseYouTubeId("javascript:alert(1)")).toBeNull();
    expect(parseYouTubeId("short")).toBeNull();
  });
  it("round-trips local datetime inputs", () => {
    const iso = "2026-12-01T08:30:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });
});

describe("validation schemas", () => {
  it("accepts Bangladeshi mobile formats and rejects others", () => {
    for (const ok of ["01712345678", "+8801712345678", "8801712345678"]) expect(bdPhone.safeParse(ok).success).toBe(true);
    for (const bad of ["12345", "01212345678", "0171234567", "+441712345678"]) expect(bdPhone.safeParse(bad).success).toBe(false);
  });
  it("enforces registration rules", () => {
    const base = { full_name: "Rafi Ahmed", email: "rafi@example.com", phone: "01712345678", password: "abcdefg1" };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "allletters" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });
  it("checks password confirmation", () => {
    expect(newPasswordSchema.safeParse({ password: "abcdefg1", confirm: "abcdefg2" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "abcdefg1", confirm: "abcdefg1" }).success).toBe(true);
  });
  it("validates course and question forms", () => {
    expect(courseSchema.safeParse({ title: "Arts batch", slug: "arts-batch", price_amount: "490" }).success).toBe(true);
    expect(courseSchema.safeParse({ title: "Arts batch", slug: "Bad Slug", price_amount: 1 }).success).toBe(false);
    expect(courseSchema.safeParse({ title: "Arts batch", slug: "arts", price_amount: -1 }).success).toBe(false);
    expect(courseSchema.safeParse({ title: "Arts batch", slug: "arts", price_amount: 10.5 }).success).toBe(false);
    const opts = [{ key: "A", text: "x" }, { key: "B", text: "y" }];
    const q = { prompt: "What?", options: opts, correct: "A", difficulty: "easy", status: "draft" };
    expect(questionSchema.safeParse(q).success).toBe(true);
    expect(questionSchema.safeParse({ ...q, options: [opts[0]] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...q, options: [opts[0], { key: "B", text: "" }] }).success).toBe(false);
  });
  it("requires a reason for enrolment changes", () => {
    const id = "3f2b8a1e-5c4d-4e6f-9a7b-1c2d3e4f5a6b";
    expect(grantSchema.safeParse({ course_id: id, reason: "ok!" }).success).toBe(true);
    expect(grantSchema.safeParse({ course_id: id, reason: "" }).success).toBe(false);
    expect(grantSchema.safeParse({ course_id: "x", reason: "fine" }).success).toBe(false);
  });
});

describe("error messages", () => {
  it("shows friendly text and never raw database errors", () => {
    expect(errorMessage(new ApiError("attempt_limit_reached"))).toMatch(/all attempts/);
    expect(errorMessage(new ApiError("forbidden"))).toMatch(/permission/);
    expect(errorMessage(new Error('duplicate key value violates unique constraint "courses_slug_key"'))).toBe("That value is already in use.");
    expect(errorMessage(new Error("SELECT blah FROM secret_table failed"))).toMatch(/Something went wrong/);
    expect(errorMessage("weird")).toMatch(/Something went wrong/);
  });
});
