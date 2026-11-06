import { type ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import { site } from "@/app/siteConfig";

const Wrap = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mx-auto max-w-3xl px-4 py-12"><h1 className="mb-6 text-3xl sm:text-4xl">{title}</h1><div className="space-y-4 leading-relaxed text-ink-soft">{children}</div></div>
);
const H = ({ children }: { children: ReactNode }) => <h2 className="pt-4 text-xl text-ink">{children}</h2>;

export function AboutPage() {
  return (
    <Wrap title="About us">
      <p>{site.name} helps students prepare for competitive admission tests. We combine recorded classes, downloadable study material and timed online exams so you can learn, practise and measure progress in one place.</p>
      <H>How it works</H>
      <p>Create an account, pick a course and complete the payment through our secure gateway. Your access opens automatically once the payment is verified. Exams are timed and scored on our servers, so results are fair and cannot be altered from the browser.</p>
    </Wrap>
  );
}
export function ContactPage() {
  return (
    <Wrap title="Contact">
      <p>Questions about courses, payments or your account? Reach us here.</p>
      <ul className="card space-y-3 p-5 text-ink">
        <li className="flex items-center gap-3"><Mail className="h-5 w-5 text-brand-600" aria-hidden /><a className="font-medium underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></li>
        <li className="flex items-center gap-3"><Phone className="h-5 w-5 text-brand-600" aria-hidden />{site.supportPhone}</li>
        <li className="text-sm text-ink-mute">Support hours: {site.supportHours}</li>
      </ul>
      <p className="text-sm">For payment problems, include your order reference (starts with “AV-”) so we can help faster.</p>
    </Wrap>
  );
}
export function TermsPage() {
  return (
    <Wrap title="Terms of use">
      <p className="rounded-lg bg-amber-soft p-3 text-sm text-ink">Draft for legal review. Replace this text with your approved terms before launch.</p>
      <H>Accounts</H><p>You are responsible for keeping your login details private. Course access is personal and must not be shared or resold.</p>
      <H>Payments and access</H><p>Access is granted after the payment gateway confirms your payment. Refunds are handled case by case and may remove access to the course.</p>
      <H>Content</H><p>Videos, materials and exam questions are protected by copyright. Copying or redistributing them is not allowed.</p>
    </Wrap>
  );
}
export function PrivacyPage() {
  return (
    <Wrap title="Privacy policy">
      <p className="rounded-lg bg-amber-soft p-3 text-sm text-ink">Draft for legal review. Replace this text with your approved policy before launch.</p>
      <H>What we collect</H><p>Your name, email, mobile number, enrolment, payment status and exam activity. We do not store card or mobile-wallet details; payments are handled by the gateway.</p>
      <H>How we use it</H><p>To run your account, give you access to purchased courses, process payments, and improve our service. We do not sell personal data.</p>
      <H>Your choices</H><p>You can update your profile at any time and contact us to request correction or deletion.</p>
    </Wrap>
  );
}
export function NotFoundPage() {
  return <Wrap title="Page not found"><p>The page you are looking for does not exist.</p><a className="btn-primary" href="/">Go home</a></Wrap>;
}
