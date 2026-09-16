export interface SampleLetter {
  id: string;
  label: string;
  sourceName: string;
  text: string;
}

/**
 * Realistic demo letters modeled on real US district notices.
 * These carry the demo video: judge sees exactly what a parent receives.
 */
export const SAMPLE_LETTERS: SampleLetter[] = [
  {
    id: "consent-eval",
    label: "Consent for evaluation",
    sourceName: "Lincoln Middle School",
    text: `LINCOLN MIDDLE SCHOOL - STUDENT SUPPORT SERVICES
Date: September 8, 2026

Dear Parent or Guardian,

Based on classroom observations and data from universal screening, the Student Support Team recommends an individual evaluation for your child, Amara O., to determine eligibility for special education and related services.

Please review and sign the enclosed Consent for Evaluation form (Form SE-3). This consent allows qualified school personnel to administer individual assessments, which may include cognitive, academic, speech-language, and social-emotional measures, during the school day.

Federal and state regulations allow fourteen (14) calendar days from the date of this notice for written consent. If consent is returned, the evaluation will be completed within sixty (60) school days and you will receive an invitation to an eligibility meeting.

You may decline consent, revoke it at any time in writing, or request that the district provide you with a copy of the evaluation report in your home language. An interpreter can be arranged for all meetings at no cost to you.

Sincerely,
Ms. D. Whitfield
Coordinator, Student Support Services`,
  },
  {
    id: "iep-meeting",
    label: "IEP meeting notice",
    sourceName: "Jefferson Elementary",
    text: `JEFFERSON ELEMENTARY SCHOOL
NOTICE OF IEP TEAM MEETING

Date of Notice: September 10, 2026
Meeting Date: September 24, 2026, 3:30 PM
Location: Conference Room B

Dear Parent or Guardian,

You are invited to attend an IEP Team meeting for your child, Daniel O. The purpose of this meeting is to review evaluation results and to develop, review, or revise the Individualized Education Program.

Expected attendees: principal or LEA representative, special education teacher, general education teacher, school psychologist, and you, the parent. You are a full member of this team.

Please indicate below whether you will attend, and return this slip to school by September 17, 2026. If the scheduled time is not convenient, contact the office and we will arrange a mutually agreed time, including a phone or video conference.

You may bring additional individuals who have knowledge of your child. If you need an interpreter for the meeting, please check the box below and one will be provided at no cost.

[ ] I will attend    [ ] I need an interpreter    [ ] I request a different time`,
  },
  {
    id: "discipline-notice",
    label: "Discipline notice",
    sourceName: "Westgate High School",
    text: `WESTGATE HIGH SCHOOL
NOTICE OF DISCIPLINE CONFERENCE

Date: September 12, 2026

Dear Parent or Guardian,

This letter is to inform you that your child, Marcus O., was involved in an incident on September 11, 2026, in the cafeteria, which staff have classified as Level II conduct (disruptive behavior).

In accordance with the Student Code of Conduct, the school may assign a suspension of up to three (3) school days. Before any suspension is imposed, you are invited to attend a discipline conference:

Friday, September 19, 2026, 8:15 AM, Main Office Conference Room

At the conference, the assistant principal will review the incident report, your child will have the opportunity to present their account, and a determination will be made. You may bring any materials or witnesses you wish.

If you believe this decision should be reviewed, you may file a written appeal with the principal within five (5) school days of the conference. Signing this notice only confirms receipt; it does not indicate agreement.

Please sign and return the acknowledgment portion below.

Parent/Guardian Signature: ______________________`,
  },
];
