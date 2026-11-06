import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import type { Course } from "@/types/db";
import { formatBDT } from "@/utils/format";
import { thumbnailUrl } from "./api";

export function CourseCard({ course }: { course: Course }) {
  const img = thumbnailUrl(course.thumbnail_path);
  return (
    <Link to={`/courses/${course.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5">
      <div className="flex aspect-[16/9] items-center justify-center bg-brand-100">
        {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <BookOpen className="h-10 w-10 text-brand-600" aria-hidden />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-lg leading-snug group-hover:text-brand-700">{course.title}</h3>
        {course.description && <p className="line-clamp-2 text-sm text-ink-mute">{course.description}</p>}
        <p className="mt-auto pt-2 font-semibold text-brand-800">{formatBDT(course.price_amount)}</p>
      </div>
    </Link>
  );
}
