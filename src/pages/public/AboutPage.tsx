import { Link } from "react-router-dom";
import { BookOpen, Check, ClipboardList, FileText, GraduationCap, HeartHandshake, LifeBuoy, Compass, Sparkles, Target, Eye, ShieldCheck, Gem, Users, TrendingUp, Cpu, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

type Icon = LucideIcon;

const tags = ["স্বপ্নের যাত্রা", "সঠিক দিকনির্দেশনা", "নিয়মিত অনুশীলন", "সাফল্যের প্রত্যয়"];
const checklist = ["মানসম্মত শিক্ষা", "সঠিক দিকনির্দেশনা", "নিয়মিত অনুশীলন", "শিক্ষার্থীকেন্দ্রিক সেবা"];

const services: { icon: Icon; title: string; text: string }[] = [
  { icon: BookOpen, title: "বিশ্ববিদ্যালয় ভর্তি কোর্স", text: "পরিকল্পিত ও বিষয়ভিত্তিক কোর্সের মাধ্যমে সম্পূর্ণ প্রস্তুতি।" },
  { icon: ClipboardList, title: "অনলাইন পরীক্ষা", text: "অনুশীলন, মডেল টেস্ট ও অগ্রগতি যাচাইয়ের সুযোগ।" },
  { icon: FileText, title: "শিক্ষা উপকরণ", text: "নোট, প্রশ্নব্যাংক ও প্রয়োজনীয় শিক্ষা সামগ্রী।" },
  { icon: Compass, title: "ভর্তি নির্দেশনা", text: "বিশ্ববিদ্যালয়, ইউনিট ও বিষয় নির্বাচনে সঠিক পরামর্শ।" },
  { icon: GraduationCap, title: "উচ্চশিক্ষা পরামর্শ", text: "উচ্চশিক্ষার সুযোগ, স্কলারশিপ ও বিদেশে পড়াশোনার দিকনির্দেশনা।" },
  { icon: LifeBuoy, title: "শিক্ষার্থী সহায়তা", text: "প্রশ্ন, সমস্যা ও প্রস্তুতি নিয়ে সার্বক্ষণিক সহায়তা।" },
];
const why: { icon: Icon; title: string; text: string }[] = [
  { icon: Check, title: "পরিকল্পিত প্রস্তুতি", text: "সিলেবাস অনুযায়ী ধাপে ধাপে সাজানো প্রস্তুতি।" },
  { icon: Cpu, title: "প্রযুক্তিনির্ভর শিক্ষা", text: "অনলাইন কোর্স ও ডিজিটাল পরীক্ষার মাধ্যমে আধুনিক শেখা।" },
  { icon: BarChart3, title: "নিয়মিত মূল্যায়ন", text: "নিয়মিত পরীক্ষার মাধ্যমে নিজের অবস্থান যাচাই।" },
  { icon: HeartHandshake, title: "শিক্ষার্থী-কেন্দ্রিক সহযোগিতা", text: "প্রতিটি শিক্ষার্থীর পাশে থেকে প্রয়োজনীয় সহায়তা।" },
];
const values: { icon: Icon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: "সততা", text: "স্বচ্ছতা ও বিশ্বাসযোগ্যতা আমাদের সব কাজের ভিত্তি।" },
  { icon: Gem, title: "মানসম্মত শিক্ষা", text: "শিক্ষার মান নিয়ে আমরা কোনো আপস করি না।" },
  { icon: Users, title: "সহযোগিতা", text: "শিক্ষার্থী ও মেন্টরদের পারস্পরিক সহযোগিতার পরিবেশ।" },
  { icon: TrendingUp, title: "উন্নয়ন", text: "নতুন ধারণা ও প্রযুক্তির মাধ্যমে নিরন্তর উন্নতি।" },
];
const steps = [
  { n: "১", title: "লক্ষ্য নির্ধারণ", text: "আগ্রহ ও সক্ষমতা অনুযায়ী লক্ষ্য ঠিক করা।" },
  { n: "২", title: "পরিকল্পিত প্রস্তুতি", text: "শিক্ষা উপকরণসহ বিষয়ভিত্তিক পড়াশোনা।" },
  { n: "৩", title: "অনুশীলন ও মূল্যায়ন", text: "নিয়মিত পরীক্ষার মাধ্যমে অগ্রগতি যাচাই।" },
  { n: "৪", title: "সাফল্যের পথে", text: "আত্মবিশ্বাস ও সঠিক দিকনির্দেশনা নিয়ে লক্ষ্যে এগিয়ে যাওয়া।" },
];

const SectionHead = ({ label, title, sub }: { label: string; title: string; sub?: string }) => {
  const { t } = useT();
  return (
  <div className="mx-auto mb-8 max-w-2xl text-center">
    <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-600">{t(label)}</p>
    <h2 className="text-2xl leading-snug sm:text-3xl">{t(title)}</h2>
    {sub && <p className="mt-2 text-ink-mute">{t(sub)}</p>}
  </div>
  );
};
const CardGrid = ({ items, cols }: { items: { icon: Icon; title: string; text: string }[]; cols: string }) => {
  const { t } = useT();
  return (
  <ul className={`grid gap-4 ${cols}`}>
    {items.map(({ icon: I, title, text }) => (
      <li key={title} className="card p-5">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><I className="h-5 w-5" aria-hidden /></span>
        <h3 className="font-sans text-lg font-semibold">{t(title)}</h3>
        <p className="mt-1 text-sm text-ink-soft">{t(text)}</p>
      </li>
    ))}
  </ul>
  );
};

export default function AboutPage() {
  const { t } = useT();
  return (
    <>
      {/* 1. Hero */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-20 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber">{t("আমাদের সম্পর্কে")}</p>
            <h1 className="text-3xl leading-snug sm:text-4xl lg:text-5xl">{t("স্বপ্নের যাত্রা সম্ভাবনা থেকে সাফল্যের পথে")}</h1>
            <p className="mt-4 max-w-xl text-brand-100">{t("অ্যাডমিশন ভেঞ্চার্স প্রতিটি শিক্ষার্থীর স্বপ্নের পাশে থাকতে চায় সঠিক দিকনির্দেশনা, মানসম্মত শিক্ষা এবং নির্ভরযোগ্য সহায়তা নিয়ে।")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/courses" className="btn-accent">{t("আমাদের কোর্স দেখুন →")}</Link>
              <a href="#av-introduction" className="btn border border-brand-500 text-white hover:bg-brand-800">{t("আমাদের সম্পর্কে জানুন")}</a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">
              {tags.map((g) => <li key={g} className="flex items-center gap-1.5 rounded-full border border-brand-700 bg-brand-800/60 px-3 py-1 text-sm"><Sparkles className="h-3.5 w-3.5 text-amber" aria-hidden />{t(g)}</li>)}
            </ul>
          </div>
          <div className="mx-auto flex w-full max-w-xs flex-col items-center rounded-3xl border border-brand-700 bg-brand-800/60 p-8 text-center">
            <svg viewBox="0 0 64 64" className="h-20 w-20" aria-hidden><rect width="64" height="64" rx="14" fill="#f2b84b" /><path d="M18 46 32 16l14 30M23.5 36h17" fill="none" stroke="#0f3d3e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <p className="mt-4 font-display text-xl">Admission Ventures</p>
            <p className="mt-1 text-sm text-brand-200">{t("সম্ভাবনা থেকে সাফল্যের পথে")}</p>
          </div>
        </div>
      </section>

      {/* 2. Identity */}
      <section id="av-introduction" className="mx-auto max-w-4xl scroll-mt-20 px-4 pt-16">
        <SectionHead label={t("আমাদের পরিচয়")} title={t("শিক্ষার্থীদের স্বপ্ন পূরণে একটি নির্ভরযোগ্য উদ্যোগ")} />
        <div className="space-y-4 text-ink-soft">
          <p>{t("অ্যাডমিশন ভেঞ্চার্স একটি শিক্ষামূলক উদ্যোগ, যা বিশ্ববিদ্যালয় ভর্তিচ্ছু শিক্ষার্থীদের পরিকল্পিত প্রস্তুতি ও সঠিক দিকনির্দেশনা দিয়ে এগিয়ে যেতে সাহায্য করে।")}</p>
          <p>{t("আমরা বিশ্বাস করি, প্রতিটি শিক্ষার্থীর মধ্যে রয়েছে বিরাট সম্ভাবনা। সেই সম্ভাবনাকে সাফল্যে রূপ দিতে প্রয়োজন সঠিক পরিকল্পনা, মানসম্মত উপকরণ, নিয়মিত অনুশীলন এবং সঠিক নির্দেশনা।")}</p>
          <p>{t("পরিকল্পিত কোর্স, অনলাইন পরীক্ষা, শিক্ষা উপকরণ ও পরামর্শের মাধ্যমে আমরা শিক্ষার্থীদের পাশে থাকি।")}</p>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {checklist.map((c) => <li key={c} className="flex items-center gap-3 rounded-xl bg-brand-50 p-3 font-medium"><Check className="h-5 w-5 text-brand-600" aria-hidden />{t(c)}</li>)}
        </ul>
      </section>

      {/* 3. Vision & mission */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <SectionHead label={t("আমাদের স্বপ্ন ও লক্ষ্য")} title={t("আমরা যে স্বপ্ন দেখি আগামীর সম্ভাবনাকে ঘিরে")} />
        <div className="grid gap-4 md:grid-cols-2">
          <article className="card p-6">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-soft text-amber-deep"><Eye className="h-5 w-5" aria-hidden /></span>
            <h3 className="font-sans text-xl font-semibold">{t("আমাদের ভিশন")}</h3>
            <p className="mt-2 text-ink-soft">{t("বাংলাদেশের মেধাবী শিক্ষার্থীদের জন্য মানসম্মত, সহজলভ্য ও প্রযুক্তিনির্ভর বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি নিশ্চিত করা, যেখানে তারা সহায়ক পরিবেশে নিজের সম্ভাবনা আবিষ্কার করতে পারে।")}</p>
          </article>
          <article className="card p-6">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Target className="h-5 w-5" aria-hidden /></span>
            <h3 className="font-sans text-xl font-semibold">{t("আমাদের মিশন")}</h3>
            <p className="mt-2 text-ink-soft">{t("পরিকল্পিত পড়াশোনা, মানসম্মত উপকরণ, নিয়মিত অনুশীলন ও অভিজ্ঞ মেন্টরদের মাধ্যমে প্রস্তুতিকে আরও কার্যকর করা এবং প্রতিটি শিক্ষার্থীর কাছে সঠিক তথ্য পৌঁছে দেওয়া।")}</p>
          </article>
        </div>
      </section>

      {/* 4. Services */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <SectionHead label={t("আমাদের কার্যক্রম")} title={t("শিক্ষার্থীদের জন্য আমাদের সেবাসমূহ")} sub={t("ভর্তি প্রস্তুতি থেকে উচ্চশিক্ষার পরিকল্পনা পর্যন্ত পাশে থাকার প্রয়াস।")} />
        <CardGrid items={services} cols="sm:grid-cols-2 lg:grid-cols-3" />
      </section>

      {/* 5. Why us */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <SectionHead label={t("আমাদের বিশেষত্ব")} title={t("কেন Admission Ventures আপনার প্রস্তুতির সহযাত্রী?")} />
        <CardGrid items={why} cols="sm:grid-cols-2 lg:grid-cols-4" />
      </section>

      {/* 6. Values */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <SectionHead label={t("আমাদের মূল্যবোধ")} title={t("যে আদর্শে আমরা পরিচালিত")} sub={t("সততা, দায়িত্ববোধ ও শিক্ষার্থীর কল্যাণ আমাদের সব কাজের কেন্দ্রে।")} />
        <CardGrid items={values} cols="sm:grid-cols-2 lg:grid-cols-4" />
      </section>

      {/* 7. Method */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <SectionHead label={t("আমাদের প্রস্তুতি পদ্ধতি")} title={t("প্রস্তুতি থেকে সাফল্যের যাত্রা")} sub={t("পরিকল্পনা ও ধারাবাহিক চেষ্টার মাধ্যমে চার ধাপে লক্ষ্যের পথে।")} />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="card relative p-5 pt-8">
              <span className="absolute -top-4 left-5 flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 font-display text-lg text-amber">{t(s.n)}</span>
              <h3 className="font-sans text-lg font-semibold">{t(s.title)}</h3>
              <p className="mt-1 text-sm text-ink-soft">{t(s.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 8. Quote */}
      <section className="mx-auto max-w-3xl px-4 pt-16 text-center">
        <blockquote className="rounded-3xl bg-brand-50 p-8 sm:p-12">
          <p className="font-display text-5xl leading-none text-brand-200" aria-hidden>“</p>
          <p className="font-display text-xl leading-relaxed sm:text-2xl">{t("আমাদের লক্ষ্য শুধু শিক্ষার্থীদের ভর্তি পরীক্ষার জন্য প্রস্তুত করা নয়, বরং তাদের স্বপ্নের বিশ্ববিদ্যালয়ের জন্য যোগ্য করে গড়ে তোলা।")}</p>
          <footer className="mt-4 text-sm font-semibold text-brand-700">{t("— অ্যাডমিশন ভেঞ্চার্স")}</footer>
        </blockquote>
      </section>

      {/* 9. CTA */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="rounded-3xl bg-brand-900 p-8 text-center text-white sm:p-12">
          <svg viewBox="0 0 64 64" className="mx-auto h-12 w-12" aria-hidden><rect width="64" height="64" rx="14" fill="#f2b84b" /><path d="M18 46 32 16l14 30M23.5 36h17" fill="none" stroke="#0f3d3e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h2 className="mt-4 text-2xl sm:text-3xl">{t("শুরু হোক নতুন সম্ভাবনা")}</h2>
          <p className="mt-1 font-display text-lg text-amber">{t("আপনার স্বপ্নের যাত্রায় আমরা আছি আপনার পাশে")}</p>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">{t("আজই শুরু করুন আপনার প্রস্তুতি, আত্মবিশ্বাস আর সঠিক পরিকল্পনা নিয়ে।")}</p>
          <Link to="/courses" className="btn-accent mt-6">{t("আমাদের কোর্স দেখুন →")}</Link>
        </div>
      </section>
    </>
  );
}
