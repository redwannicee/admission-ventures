import { tr } from "@/i18n";
import { z } from "zod";

export const bdPhone = z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number, e.g. 01712345678");
const password = z.string().min(8, "At least 8 characters").max(72, "Too long").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number");

export const loginSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email"),
  phone: bdPhone,
  password,
});
export const resetRequestSchema = z.object({ email: z.string().trim().email("Enter a valid email") });
export const newPasswordSchema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
export const profileSchema = z.object({ full_name: z.string().trim().min(2, "Enter your name").max(100), phone: bdPhone });

export const courseSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(150),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only").max(80),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  price_amount: z.coerce.number().int("Whole taka only").min(0, "Cannot be negative").max(1_000_000),
});
export const questionSchema = z.object({
  prompt: z.string().trim().min(3, "Question text is required").max(2000),
  options: z.array(z.object({ key: z.string(), text: z.string().trim().min(1, "Option text is required").max(500) })).min(2, "At least two options").max(6),
  correct: z.string().min(1, "Choose the correct option"),
  explanation: z.string().trim().max(3000).optional().or(z.literal("")),
  difficulty: z.enum(["easy", "medium", "hard"]),
  status: z.enum(["draft", "published", "archived"]),
  category_id: z.string().optional().or(z.literal("")),
});
export const grantSchema = z.object({
  course_id: z.string().uuid("Choose a course"),
  reason: z.string().trim().min(3, "Give a reason").max(500),
  expires_at: z.string().optional().or(z.literal("")),
});
export const firstIssue = (e: z.ZodError): string => tr(e.issues[0]?.message ?? "Please check the form");
