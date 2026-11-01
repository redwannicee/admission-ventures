import { createClient } from '@supabase/supabase-js';
import {
  FALLBACK_COURSES,
  FALLBACK_MENTORS,
  FALLBACK_TESTIMONIALS,
  type Course,
  type Mentor,
  type Testimonial,
} from './content';

/**
 * Cookie-less anon client so public pages stay fully static (no per-user rendering).
 * Returns null when Supabase is not configured, and callers fall back to sample content.
 */
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('YOUR-PROJECT')) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function load<T>(fallback: T[], run: (sb: NonNullable<ReturnType<typeof publicClient>>) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const sb = publicClient();
  if (!sb) return fallback;
  try {
    const { data, error } = await run(sb);
    if (error || !Array.isArray(data) || data.length === 0) return fallback;
    return data as T[];
  } catch {
    return fallback;
  }
}

export const getCourses = () =>
  load<Course>(FALLBACK_COURSES, (sb) =>
    sb
      .from('courses')
      .select('slug,title_en,title_bn,description_en,description_bn,category,price,compare_at_price,features')
      .eq('is_active', true)
      .order('sort_order')
      .limit(12),
  );

export const getMentors = () =>
  load<Mentor>(FALLBACK_MENTORS, (sb) =>
    sb
      .from('mentors')
      .select('id,name_en,name_bn,institution,bio_en,bio_bn')
      .eq('is_published', true)
      .order('sort_order')
      .limit(16),
  );

export const getTestimonials = () =>
  load<Testimonial>(FALLBACK_TESTIMONIALS, (sb) =>
    sb
      .from('testimonials')
      .select('id,student_name,achievement_en,achievement_bn,quote_en,quote_bn')
      .eq('is_published', true)
      .order('sort_order')
      .limit(12),
  );
