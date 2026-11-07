/**
 * Marketing content taken from admissionventures.com. Images are linked from that site
 * (copy them into /public and change the URLs here if you want to host them yourselves).
 */
const UP = "https://admissionventures.com/dpanel/uploads";

export const heroSlides = [
  { title: "Signature Success", src: `${UP}/sliders/slider_1782236809_6a3ac6898be9e.jpeg` },
  { title: "Mentor Panel ~ AV", src: `${UP}/sliders/slider_1779699528_6a140f48ccc7b.jpeg` },
  { title: "Admission Ventures", src: `${UP}/sliders/slider_1778857261_6a07352d8e5af.png` },
  { title: "Achieve Your Dream", src: `${UP}/sliders/slider_1778522060_6a0217cc427fd.jpeg` },
];

export const videos = ["wHZVsRDDxVA", "esQzHk2JqjU", "7nmOEdN4uJ8"];

export interface Member { name: string; role: string; edu?: string; photo: string; }
const img = (file: string) => `${UP}/team_member/${file}`;
export const team: Member[] = [
  { name: "Nafis Erteja", role: "CEO & Founder", edu: "University of Chittagong", photo: img("1778433954_Nafis.jpeg") },
  { name: "Shehab Rahaman", role: "Co-Founder & MD", edu: "University of Asia Pacific", photo: img("1778433319_Shehab.jpeg") },
  { name: "Raisa Anjum Sondhi", role: "Co-Founder & Arts Mentor", edu: "University of Dhaka", photo: img("1778433443_Sondhi.jpeg") },
  { name: "Mahfuz Chowdhury", role: "Commerce Segment Head", edu: "University of Chittagong", photo: img("1778433236_MAhfuj.jpeg") },
  { name: "Archita Saha Prapti", role: "Mentor, Math & Physics", edu: "BUET", photo: img("1778433025_Prapty.jpeg") },
  { name: "Rownok Sadab", role: "Mentor, Math & Physics", edu: "BUET", photo: img("1778432964_Rownak.jpeg") },
  { name: "Masrur Junaet", role: "Mentor, Math & Physics", edu: "BUET", photo: img("1778432637_Junaet.jpeg") },
  { name: "Rafia Tasnim", role: "Mentor, Math", edu: "HSTU", photo: img("1778433516_Rafia.jpeg") },
  { name: "Anika Anwar", role: "Mentor, Physics & Chemistry", edu: "HSTU", photo: img("1778432681_Anika.jpeg") },
  { name: "Risalat Hasan Raisha", role: "Mentor, Physics", edu: "University of Rajshahi", photo: img("1778432353_Risalat.jpeg") },
  { name: "Sadika Rubia Rinki", role: "Mentor, Biology & Chemistry", edu: "PUST", photo: img("1778432853_Rinki.jpeg") },
  { name: "Md. Shohaimim Islam", role: "Mentor, Biology & Chemistry", edu: "University of Chittagong", photo: img("1778432777_Personal.jpeg") },
  { name: "Sifat E Sadia Prioti", role: "Mentor, Biology", edu: "Naogaon Medical College", photo: img("1778433870_Prioty.jpeg") },
  { name: "Md. Sadman Sakib", role: "Mentor, Biology", edu: "Sylhet Agricultural University", photo: img("1778434021_Munnaf.jpeg") },
  { name: "Mizanur Rahman", role: "Marketing Executive", edu: "University of Rajshahi", photo: img("1778432416_Boost.jpeg") },
  { name: "Sifat", role: "Graphic Designer (Social Media Branding)", photo: img("1778433737_Poster.jpeg") },
];

export const faqs: { q: string; a: string }[] = [
  { q: "What is Admission Ventures?", a: "A platform that helps university applicants with guidance, recorded classes, study materials, exam batches and mentorship." },
  { q: "Who can join?", a: "University and medical admission candidates who want structured guidance and mentorship." },
  { q: "What does the exam batch include?", a: "200+ topic and chapter exams, full-syllabus classes and exams, mentorship and live guidance sessions, booster PDFs, instant doubt solving, solve-sheets with explanations, and a premium discussion group." },
  { q: "What if I miss a class or an exam?", a: "Classes are recorded and archived, and missed exams can be taken again at any time." },
  { q: "How are classes delivered?", a: "Mainly as high-quality recorded classes designed to feel like offline classes." },
  { q: "How do I pay?", a: "Online through our secure payment gateway (mobile wallets such as bKash, Nagad and Rocket). Access opens as soon as the payment is confirmed." },
  { q: "What do I get after enrolling?", a: "Premium WhatsApp and Telegram groups, classes and evaluations, archived exam links, study materials, mentor support, and a learning community." },
  { q: "What study materials are provided?", a: "PDF notes, short notes, question banks, CQ/MCQ sheets and special practice materials." },
  { q: "How does doubt support work?", a: "Ask the mentor panel and support team any time; they respond to your questions." },
];

export const vision = "To be a trusted companion for students reaching their dream university, with quality, accessible, tech-driven admission preparation across Bangladesh.";
