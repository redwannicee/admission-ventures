export type Course = {
  slug: string;
  title_en: string;
  title_bn: string;
  description_en: string | null;
  description_bn: string | null;
  category: string | null;
  price: number;
  compare_at_price: number | null;
  features: { en: string; bn: string }[];
};

export type Mentor = {
  id: string;
  name_en: string;
  name_bn: string;
  institution: string;
  bio_en: string | null;
  bio_bn: string | null;
};

export type Testimonial = {
  id: string;
  student_name: string;
  achievement_en: string | null;
  achievement_bn: string | null;
  quote_en: string | null;
  quote_bn: string | null;
};

// Shown only when Supabase is not configured or the tables are empty (first deploy).
// Replace by adding real rows in the admin panel (Phase 5).
export const FALLBACK_COURSES: Course[] = [
  {
    slug: 'second-timer-exam-batch-arts',
    title_en: 'Second Timer Exam Batch (Arts)',
    title_bn: 'সেকেন্ড টাইমার এক্সাম ব্যাচ (আর্টস)',
    description_en: 'Daily, weekly and monthly exams with paper finals for Arts admission.',
    description_bn: 'আর্টস ভর্তি প্রস্তুতির জন্য ডেইলি, উইকলি, মান্থলি পরীক্ষা ও পেপার ফাইনাল।',
    category: 'arts',
    price: 490,
    compare_at_price: 790,
    features: [
      { en: 'Daily exams', bn: 'ডেইলি পরীক্ষা' },
      { en: 'Weekly exams', bn: 'উইকলি পরীক্ষা' },
      { en: 'Monthly exams', bn: 'মান্থলি পরীক্ষা' },
      { en: 'Paper finals', bn: 'পেপার ফাইনাল' },
    ],
  },
  {
    slug: 'second-timer-science-recorded-batch',
    title_en: 'Science Recorded Batch',
    title_bn: 'সায়েন্স রেকর্ডেড ব্যাচ',
    description_en: 'Recorded lectures and exams for Science admission.',
    description_bn: 'সায়েন্স ভর্তি প্রস্তুতির জন্য রেকর্ডেড ক্লাস ও পরীক্ষা।',
    category: 'science',
    price: 790,
    compare_at_price: null,
    features: [
      { en: 'Recorded lectures', bn: 'রেকর্ডেড ক্লাস' },
      { en: 'Subject finals', bn: 'সাবজেক্ট ফাইনাল' },
    ],
  },
];

export const FALLBACK_MENTORS: Mentor[] = [
  { id: 'm1', name_en: 'Mentor Name', name_bn: 'মেন্টরের নাম', institution: 'DU', bio_en: 'Sample profile', bio_bn: 'নমুনা প্রোফাইল' },
  { id: 'm2', name_en: 'Mentor Name', name_bn: 'মেন্টরের নাম', institution: 'BUET', bio_en: 'Sample profile', bio_bn: 'নমুনা প্রোফাইল' },
  { id: 'm3', name_en: 'Mentor Name', name_bn: 'মেন্টরের নাম', institution: 'RU', bio_en: 'Sample profile', bio_bn: 'নমুনা প্রোফাইল' },
  { id: 'm4', name_en: 'Mentor Name', name_bn: 'মেন্টরের নাম', institution: 'Medical', bio_en: 'Sample profile', bio_bn: 'নমুনা প্রোফাইল' },
];

export const FALLBACK_TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    student_name: 'Student Name',
    achievement_en: 'Hall of Fame (sample)',
    achievement_bn: 'হল অব ফেম (নমুনা)',
    quote_en: 'Real student reviews will appear here once added in the admin panel.',
    quote_bn: 'অ্যাডমিন প্যানেল থেকে যোগ করলে এখানে শিক্ষার্থীদের আসল রিভিউ দেখা যাবে।',
  },
];
