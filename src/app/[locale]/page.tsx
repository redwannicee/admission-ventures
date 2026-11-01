import { setRequestLocale } from 'next-intl/server';
import { getCourses, getMentors, getTestimonials } from '@/lib/data';
import { Courses, CtaBand, ExamSystem, Hero, Mentors, Stats, Testimonials } from '@/components/landing/sections';

// Prerendered per locale at build time. Content refreshes on redeploy; ISR can be added
// later with an R2 incremental cache.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [courses, mentors, testimonials] = await Promise.all([getCourses(), getMentors(), getTestimonials()]);

  return (
    <>
      <Hero />
      <Stats />
      <Courses courses={courses} />
      <ExamSystem />
      <Mentors mentors={mentors} />
      <Testimonials items={testimonials} />
      <CtaBand />
    </>
  );
}
