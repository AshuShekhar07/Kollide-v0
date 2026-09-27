import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'
import { PRIVACY_COPY } from '../lib/chat'

// Operator details still to be filled in before launch (PLAN.md §8). They
// render highlighted so they can't be missed.
const OPERATOR = '[OPERATOR NAME]'
const CONTACT_EMAIL = '[CONTACT EMAIL]'
const GRIEVANCE_OFFICER = '[GRIEVANCE OFFICER NAME]'
const EFFECTIVE = 'October 4, 2026'

function Blank({ children }: { children: string }) {
  return <mark className="rounded bg-amber-200 px-1 font-semibold text-amber-950">{children}</mark>
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <Link to="/" aria-label="Kollide home">
        <Logo className="text-2xl" />
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">Effective {EFFECTIVE}</p>
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-neutral-700 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-neutral-900 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-10 text-sm text-neutral-500">
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>{' '}
        ·{' '}
        <Link to="/terms" className="underline">
          Terms of Service
        </Link>
      </p>
    </main>
  )
}

function Contact() {
  return (
    <>
      <Blank>{GRIEVANCE_OFFICER}</Blank>, Grievance Officer, <Blank>{OPERATOR}</Blank>, at <Blank>{CONTACT_EMAIL}</Blank>
    </>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Kollide helps verified people find a friend or a group to go to events with, starting with Garba and Dandiya in
        Bangalore. Kollide is run by <Blank>{OPERATOR}</Blank> ("we"). This policy explains what we collect, why, who
        can see it, how long we keep it, and how to delete it. By creating an account you consent to this processing,
        as you confirm with the checkbox at signup.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your email address (used to sign in), phone number, and at least one
            social handle (Instagram, Snapchat, WhatsApp or Telegram).
          </li>
          <li>
            <strong>Profile:</strong> first name, date of birth, gender, who you'd like to meet, whether you're looking
            for a friend or a group, a short intro about you, your answers to up to 3 profile questions, 2–6 photos,
            and the activities you pick.
          </li>
          <li>
            <strong>Verification video:</strong> a 5–10 second video of your face, recorded in the app, used only to
            check that you're a real person who matches your photos.
          </li>
          <li>
            <strong>Activity on Kollide:</strong> likes and passes, matches, groups you create, join or are invited
            to, chat messages, blocks and reports.
          </li>
          <li>
            <strong>Usage events:</strong> simple records such as "signed up" or "created a group", used to count how
            many people reach each step. We don't use advertising trackers.
          </li>
          <li>
            <strong>Technical data:</strong> sign-in and security logs kept by our hosting providers.
          </li>
          <li>
            <strong>Location:</strong> Kollide is only in Bangalore for now, so with your permission the app checks
            on your device whether you're in or near Bangalore. Your location is never sent to us or stored; we only
            use it to show a notice if you're elsewhere.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why we collect it</h2>
        <ul>
          <li>To create your account and let you sign in.</li>
          <li>To verify that every member is a real adult who matches their photos.</li>
          <li>To show your profile to other members and suggest people and groups going to the same events.</li>
          <li>To run chats, and to share your socials with the people you match or group with.</li>
          <li>To keep members safe: review reports, stop banned people from coming back, and prevent fake accounts.</li>
          <li>To send account emails, such as your verification result. We don't send marketing email.</li>
          <li>To understand, in aggregate, how Kollide is used, so we can improve it.</li>
        </ul>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li>
            <strong>Other members</strong> see your first name, public code, age, intro, answers and photos. Unverified members
            can only see a limited number of profiles a day. Only verified members appear to others.
          </li>
          <li>
            <strong>Your socials</strong> are shown only to people you match with and to members of groups you're
            approved into. Your email address and phone number are never shown to other members.
          </li>
          <li>
            <strong>People outside a group</strong> see its members' first names and public codes only, not photos.
          </li>
          <li>
            <strong>Our review team</strong> watches verification videos and reviews reports. This access is limited
            to a small team, and every time someone opens a video or a report, it is logged.
          </li>
          <li>
            <strong>Service providers</strong> who host and run Kollide for us: Supabase (database, file storage and
            sign-in), Cloudflare (website hosting) and Google (sending email). They process data only on our
            instructions. Their servers may be outside India.
          </li>
          <li>We don't sell your data, and we don't share it with advertisers.</li>
          <li>We may disclose data when the law requires it, for example to law enforcement with a valid request.</li>
        </ul>
      </section>

      <section>
        <h2>Chats</h2>
        <p>
          Messages are text only and are stored encrypted at rest by our database provider. {PRIVACY_COPY} Our team
          doesn't read chats that haven't been reported.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>
            <strong>Verification videos</strong> are never kept long-term. After review, the file is permanently
            deleted <strong>48 hours after approval</strong>, or <strong>30 days after rejection</strong> (so we can
            spot repeat fake signups). If you delete your account before your video is reviewed, it is deleted right
            away.
          </li>
          <li>
            <strong>Your profile, photos, likes, matches, groups and chats</strong> are kept while your account is open
            and deleted when you delete it.
          </li>
          <li>
            <strong>Profile-view records</strong> (used for the daily limit on unverified accounts) are deleted after
            about two days.
          </li>
          <li>
            <strong>Reported conversations</strong> are kept as evidence. When someone reports a conversation, a copy
            of it (messages, senders and times) is saved with the report and is not deleted by any cleanup, even if
            either person later deletes their account. We keep reports only as long as needed for safety and legal
            purposes.
          </li>
          <li>
            <strong>Bans:</strong> if an account is banned, we keep its email, phone number and social handles on a
            ban list so that person can't sign up again.
          </li>
          <li>
            <strong>Usage events</strong> are kept in aggregate form; when you delete your account they are no longer
            linked to you.
          </li>
        </ul>
      </section>

      <section>
        <h2>Deleting your account</h2>
        <p>
          Go to <strong>Profile → Settings → Delete account</strong> and type DELETE to confirm. This deletes your
          profile, photos, likes, matches, group memberships and chats right away and can't be undone. If you run a
          group, the longest-standing member takes over. Reports, ban-list entries and a reviewed verification video
          (until its scheduled deletion) are kept as described above. You can also ask us to delete your account by
          emailing <Blank>{CONTACT_EMAIL}</Blank>.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Under India's Digital Personal Data Protection Act, 2023, you can ask to access a summary of your data, to
          correct or update it, and to erase it. You can withdraw your consent at any time by deleting your account.
          You can also nominate someone to exercise these rights for you if you're unable to. To make a request or a
          complaint, contact <Contact />. We aim to respond within 7 days. If you're not satisfied with our response,
          you can complain to the Data Protection Board of India.
        </p>
      </section>

      <section>
        <h2>Age</h2>
        <p>Kollide is only for people aged 18 or over. We don't knowingly collect data from anyone younger.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If we change this policy in a meaningful way, we'll tell you in the app or by email before the change takes
          effect.
        </p>
      </section>
    </LegalPage>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and <Blank>{OPERATOR}</Blank>, which runs Kollide. By creating an
        account you agree to them and to our{' '}
        <Link to="/privacy" className="font-semibold text-brand-700 underline">
          Privacy Policy
        </Link>
        .
      </p>

      <section>
        <h2>Who can use Kollide</h2>
        <ul>
          <li>You must be at least 18 years old.</li>
          <li>Kollide currently runs only in Bangalore, and is meant for people in or visiting the city.</li>
          <li>You may have only one account, and it must be about you: your real first name, photos and details.</li>
          <li>You must complete verification with a video of your own face.</li>
          <li>You can't use Kollide if we've banned you before.</li>
        </ul>
      </section>

      <section>
        <h2>What Kollide is</h2>
        <p>
          Kollide helps people find a friend or a group to go to events with. It is not a dating service. We verify
          that members are real people who match their photos, but we can't guarantee how anyone will behave, and we
          don't run background checks.
        </p>
      </section>

      <section>
        <h2>Code of conduct</h2>
        <ul>
          <li>Be respectful. No harassment, bullying, threats, hate speech or stalking.</li>
          <li>No sexual or explicit content, and no unwanted advances.</li>
          <li>No spam, selling, promotions or asking for money.</li>
          <li>No fake profiles, impersonation or misleading photos.</li>
          <li>Don't share anyone else's personal details or screenshots of their chats without their permission.</li>
          <li>Take "no" for an answer. If someone declines, leaves a group or stops replying, let it go.</li>
          <li>Don't use Kollide for anything illegal.</li>
        </ul>
      </section>

      <section>
        <h2>Groups</h2>
        <p>
          If you start a group, you're its admin: you choose who joins and can remove members. Use this fairly and
          never to discriminate or harass. If you leave, admin passes to the longest-standing member.
        </p>
      </section>

      <section>
        <h2>Staying safe</h2>
        <ul>
          <li>Meet in busy public places, and tell a friend where you're going.</li>
          <li>Arrange your own travel, and don't share your home address early on.</li>
          <li>Use Block and Report whenever something feels wrong. Reporting also blocks the person.</li>
          <li>
            If you're in danger or being threatened or stalked, call the national cybercrime helpline{' '}
            <a href="tel:1930" className="font-semibold text-brand-700 underline">
              1930
            </a>{' '}
            or report at{' '}
            <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
              cybercrime.gov.in
            </a>
            . In an emergency, call 112.
          </li>
        </ul>
      </section>

      <section>
        <h2>Moderation and bans</h2>
        <p>
          We review reports and may warn, suspend or ban accounts that break these terms, at our discretion. A ban
          covers your email, phone number and social handles, so you can't sign up again with them. When a
          conversation is reported, our safety team reviews it, as explained in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own the photos, intro, answers and messages you post. You give us permission to store and show them to other
          members as needed to run Kollide. You're responsible for what you post and confirm you have the right to
          post it.
        </p>
      </section>

      <section>
        <h2>Ending your account</h2>
        <p>
          You can delete your account at any time from Settings. We may suspend or close accounts that break these
          terms or put others at risk.
        </p>
      </section>

      <section>
        <h2>Limits of our responsibility</h2>
        <p>
          Kollide is provided as it is, and we can't promise it will always be available or error-free. You're
          responsible for your own decisions about meeting people. To the extent the law allows, we aren't liable for
          the conduct of other members, online or offline, or for indirect losses. Nothing here limits rights you have
          under Indian consumer law.
        </p>
      </section>

      <section>
        <h2>Law and disputes</h2>
        <p>
          These terms are governed by the laws of India, and the courts of Bengaluru, Karnataka have jurisdiction. For
          complaints, contact <Contact />.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms. If a change is meaningful, we'll tell you in the app or by email before it takes
          effect. Continuing to use Kollide after that means you accept the new terms.
        </p>
      </section>
    </LegalPage>
  )
}
