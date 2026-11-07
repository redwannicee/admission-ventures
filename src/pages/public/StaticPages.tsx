import { type ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { team } from "@/app/content";
import { site } from "@/app/siteConfig";
import { useT } from "@/i18n";

const Wrap = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mx-auto max-w-3xl px-4 py-12"><h1 className="mb-6 text-3xl sm:text-4xl">{title}</h1><div className="space-y-4 leading-relaxed text-ink-soft">{children}</div></div>
);
const H = ({ children }: { children: ReactNode }) => <h2 className="pt-4 text-xl text-ink">{children}</h2>;

export function ContactPage() {
  const { t } = useT();
  return (
    <Wrap title={t("Contact")}>
      <p>{t("Questions about courses, payments or your account? Reach us here.")}</p>
      <ul className="card space-y-3 p-5 text-ink">
        <li className="flex items-center gap-3"><Mail className="h-5 w-5 text-brand-600" aria-hidden /><a className="font-medium underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></li>
        {site.phones.map((p) => <li key={p} className="flex items-center gap-3"><Phone className="h-5 w-5 text-brand-600" aria-hidden /><a className="font-medium" href={`tel:${p}`}>{p}</a></li>)}
        <li className="flex items-center gap-3"><MapPin className="h-5 w-5 text-brand-600" aria-hidden />{site.office}</li>
        <li><a className="btn-primary btn-sm" href={site.whatsapp} target="_blank" rel="noopener noreferrer">{t("Chat on WhatsApp")}</a></li>
      </ul>
      <p className="text-sm">{t("For payment problems, include your order reference (starts with “AV-”) so we can help faster.")}</p>
    </Wrap>
  );
}
export function TermsPage() {
  const { t } = useT();
  return (
    <Wrap title={t("Terms of use")}>
      <p className="rounded-lg bg-amber-soft p-3 text-sm text-ink">{t("Draft for legal review. Replace this text with your approved terms before launch.")}</p>
      <H>{t("Accounts")}</H><p>{t("You are responsible for keeping your login details private. Course access is personal and must not be shared or resold.")}</p>
      <H>{t("Payments and access")}</H><p>{t("Access is granted after the payment gateway confirms your payment. Refunds are handled case by case and may remove access to the course.")}</p>
      <H>{t("Content")}</H><p>{t("Videos, materials and exam questions are protected by copyright. Copying or redistributing them is not allowed.")}</p>
    </Wrap>
  );
}
export function PrivacyPage() {
  const { t } = useT();
  return (
    <Wrap title={t("Privacy policy")}>
      <p className="rounded-lg bg-amber-soft p-3 text-sm text-ink">{t("Draft for legal review. Replace this text with your approved policy before launch.")}</p>
      <H>{t("What we collect")}</H><p>{t("Your name, email, mobile number, enrolment, payment status and exam activity. We do not store card or mobile-wallet details; payments are handled by the gateway.")}</p>
      <H>{t("How we use it")}</H><p>{t("To run your account, give you access to purchased courses, process payments, and improve our service. We do not sell personal data.")}</p>
      <H>{t("Your choices")}</H><p>{t("You can update your profile at any time and contact us to request correction or deletion.")}</p>
    </Wrap>
  );
}
export function NotFoundPage() {
  const { t } = useT();
  return <Wrap title={t("Page not found")}><p>{t("The page you are looking for does not exist.")}</p><a className="btn-primary" href="/">{t("Go home")}</a></Wrap>;
}

export function TeamPage() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-2 text-3xl sm:text-4xl">{t("Our team")}</h1>
      <p className="mb-8 text-ink-mute">The founders and mentors behind {site.name}.</p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {team.map((m) => (
          <li key={m.name} className="card overflow-hidden text-center">
            <img src={m.photo} alt={m.name} loading="lazy" className="aspect-square w-full object-cover" />
            <div className="p-3"><p className="font-semibold leading-tight">{m.name}</p><p className="mt-0.5 text-xs text-ink-mute">{m.role}</p>{m.edu && <p className="text-xs text-brand-700">{m.edu}</p>}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
