import type { Job } from "./jobs";
// Illustrative examples only; not verified vacancies or employer endorsements.
export const demoJobs: Job[] = [
  { title: "Associate Product Manager", company: "Razorpay", location: "Bengaluru, India", workMode: "Hybrid", role: "Product", salary: "₹18–25 LPA", experience: "Entry level", skills: ["Product strategy", "Analytics", "Fintech"] },
  { title: "Business Analyst", company: "Deloitte", location: "Mumbai, India", workMode: "Hybrid", role: "Consulting", salary: "₹10–16 LPA", experience: "Entry level", skills: ["Problem solving", "SQL", "Consulting"] },
  { title: "Growth Product Manager", company: "Swiggy", location: "Bengaluru, India", workMode: "On-site", role: "Growth", salary: "₹22–32 LPA", experience: "Mid level", skills: ["Experimentation", "Growth", "User retention"] },
  { title: "Product Designer", company: "Groww", location: "India", workMode: "Remote", role: "Design", salary: "₹16–24 LPA", experience: "Mid level", skills: ["Figma", "UX research", "Prototyping"] },
  { title: "Strategy & Operations Associate", company: "Meesho", location: "Bengaluru, India", workMode: "Hybrid", role: "Business", salary: "₹14–20 LPA", experience: "Mid level", skills: ["Business strategy", "Operations", "Analytics"] },
  { title: "Product Management Intern", company: "Freshworks", location: "Chennai, India", workMode: "Hybrid", role: "Product", salary: "₹30,000–45,000 / month", experience: "Entry level", skills: ["Product discovery", "SaaS", "Research"], employmentType: "Internship" },
  { title: "Senior Product Manager", company: "PhonePe", location: "Bengaluru, India", workMode: "On-site", role: "Product", salary: "₹35–50 LPA", experience: "Senior level", skills: ["Payments", "Roadmapping", "Leadership"] },
  { title: "Associate Consultant", company: "Bain & Company", location: "Gurugram, India", workMode: "On-site", role: "Consulting", salary: null, experience: "Entry level", skills: ["Case analysis", "Strategy", "Research"] },
  { title: "Growth Marketing Associate", company: "Urban Company", location: "Gurugram, India", workMode: "Hybrid", role: "Growth", salary: "₹8–12 LPA", experience: "Entry level", skills: ["Acquisition", "Campaigns", "Analytics"] },
  { title: "Founder's Office Associate", company: "CRED", location: "Bengaluru, India", workMode: "On-site", role: "Business", salary: "₹15–22 LPA", experience: "Mid level", skills: ["Strategy", "Execution", "Research"] },
  { title: "UX Researcher", company: "Postman", location: "India", workMode: "Remote", role: "Design", salary: "₹18–28 LPA", experience: "Mid level", skills: ["User interviews", "Usability", "SaaS"] },
  { title: "Business Operations Intern", company: "Zomato", location: "Delhi, India", workMode: "Hybrid", role: "Business", salary: "₹20,000–30,000 / month", experience: "Entry level", skills: ["Operations", "Excel", "Research"], employmentType: "Internship" },
].map((job, i) => ({
  ...job, role: job.role as Job["role"], id: `demo-${i + 1}`, demo: true, url: null, listingUrl: null, source: "Sample listing",
  employmentType: job.employmentType || "Full-time", postedAt: new Date(Date.UTC(2026, 8, 7) - Math.floor(i / 2) * 86400000).toISOString(),
  description: `This is an illustrative ${job.title} listing used to preview the Languify job board. It is not a verified opening at ${job.company}.\n\nIn a connected feed, this panel will display the original role description, responsibilities, qualifications, and application link supplied by the job source.\n\nThe sample salary, location, skills, and work arrangement are demonstration values only.`,
}));
