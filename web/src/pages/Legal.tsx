import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'
import { PRIVACY_COPY } from '../lib/chat'

// Kollide isn't a company: three college friends run it, share the support
// inbox, and are jointly its Grievance Officers.
const TEAM = 'Prince Kunal, Ashu Shekhar and Melove Gupta'
const CONTACT_EMAIL = 'kollide.support@gmail.com'
const EFFECTIVE = 'October 4, 2026'

function Email() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700 underline">
      {CONTACT_EMAIL}
    </a>
  )
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
      our Grievance Officers, {TEAM}, at <Email />
    </>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Kollide helps verified people find a friend or a group to go to events with, starting with Garba and Dandiya in
        cities across India. This policy explains what we collect, why, who can see it, how long we keep it, and how to delete
        it. By creating an account you consent to this processing, as you confirm with the checkbox at signup.
      </p>

      <section>
        <h2>Who we are</h2>
        <p>
          Kollide is built and run by three college friends: {TEAM} ("we", "us"). It isn't a registered company or
          business. It started as a weekend project that we run ourselves, and it's free to use. The three of us
          together decide how your data is used, so we're jointly responsible for it (the "data fiduciary" under India's
          Digital Personal Data Protection Act, 2023).
        </p>
        <p className="mt-2">
          For questions, help, or anything about your data, email <Email />. All three of us read that inbox.
        </p>
      </section>

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
            <strong>Activity on Kollide:</strong> who you kollide with or pass on, the people you've kollided with,
            groups you create, join or are invited to, chat messages, blocks and reports.
          </li>
          <li>
            <strong>Usage events:</strong> simple records such as "signed up" or "created a group", used to count how
            many people reach each step. We don't use advertising trackers.
          </li>
          <li>
            <strong>Technical data:</strong> sign-in and security logs kept by our hosting providers.
          </li>
          <li>
            <strong>Location:</strong> with your permission, the app reads your phone's location when you open it,
            so we can show you people and groups within 80 km. We save it rounded to about 1 km, with the name of the
            nearest city. If you'd rather not share it, pick a city instead and we use only that city's centre.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why we collect it</h2>
        <ul>
          <li>To create your account and let you sign in.</li>
          <li>To verify that every member is a real adult who matches their photos.</li>
          <li>To show your profile to other members and suggest people and groups going to the same events.</li>
          <li>To run chats, and to share your socials with the people you kollide or group with.</li>
          <li>To keep members safe: review reports, stop banned people from coming back, and prevent fake accounts.</li>
          <li>To send account emails, such as your verification result. We don't send marketing email.</li>
          <li>To understand, in aggregate, how Kollide is used, so we can improve it.</li>
        </ul>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li>
            <strong>Other members</strong> see your first name, age, intro, answers and photos. Unverified members can
            only see a limited number of profiles a day. Only verified members appear to others.
          </li>
          <li>
            <strong>Your location</strong> is used only to decide who you see. Other members never see it, your city,
            or how far away you are.
          </li>
          <li>
            <strong>Your socials</strong> are shown only to people you've kollided with and to members of groups
            you're approved into. Your email address and phone number are never shown to other members.
          </li>
          <li>
            <strong>Groups:</strong> if you're in a group, verified members can open your profile from it (the same
            first name, age, intro, answers and photos as above). Your socials stay hidden from anyone who isn't in
            the group with you.
          </li>
          <li>
            <strong>The three of us</strong> watch verification videos and review reports. No one else has this
            access, and every time one of us opens a video or a report, it is logged.
          </li>
          <li>
            <strong>Service providers</strong> who host and run Kollide for us: Supabase (database, file storage and
            sign-in), Cloudflare (website hosting) and Google (Google sign-in, and the Gmail account we send email from). They process data only on our
            instructions. Their servers may be outside India.
          </li>
          <li>We don't sell your data, and we don't share it with advertisers.</li>
          <li>We may disclose data when the law requires it, for example to law enforcement with a valid request.</li>
        </ul>
      </section>

      <section>
        <h2>Chats</h2>
        <p>
          Messages are text only and are stored encrypted at rest by our database provider. {PRIVACY_COPY} We don't
          read chats that haven't been reported.
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
            <strong>Your profile, location, photos, kollides, groups and chats</strong> are kept while your account is open
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
          profile, photos, kollides, group memberships and chats right away and can't be undone. If you run a
          group, the longest-standing member takes over. Reports, ban-list entries and a reviewed verification video
          (until its scheduled deletion) are kept as described above. You can also ask us to delete your account by
          emailing <Email />.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Under India's Digital Personal Data Protection Act, 2023, you can ask to access a summary of your data, to
          correct or update it, and to erase it. You can withdraw your consent at any time by deleting your account.
          You can also nominate someone to exercise these rights for you if you're unable to. To make a request or a
          complaint, contact <Contact />. We acknowledge every complaint within 24 hours and resolve it within 15
          days, usually much sooner. If you're not satisfied with our response, you can complain to the Data
          Protection Board of India.
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
          effect. If we ever stop running Kollide, we'll tell you first and delete your data as described above.
        </p>
      </section>
    </LegalPage>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {TEAM} ("we", "us"), the three college friends who build and
        run Kollide. Kollide isn't a registered company or business; it's an independent project we run ourselves.
        By creating an account you agree to these terms and to our{' '}
        <Link to="/privacy" className="font-semibold text-brand-700 underline">
          Privacy Policy
        </Link>
        .
      </p>

      <section>
        <h2>Who can use Kollide</h2>
        <ul>
          <li>You must be at least 18 years old.</li>
          <li>Kollide is for people in India. You see people and groups within 80 km of where you are, or of the city you pick.</li>
          <li>You may have only one account, and it must be about you: your real first name, photos and details.</li>
          <li>You must complete verification with a video of your own face.</li>
          <li>You can't use Kollide if we've banned you before.</li>
        </ul>
      </section>

      <section>
        <h2>What Kollide is</h2>
        <p>
          Kollide helps people find a dandiya partner, a friend or a group to go to events with. It is not a dating
          service. It's free: there are no payments, subscriptions or ads. We verify that members are real people who
          match their photos, but we can't guarantee how anyone will behave, and we don't run background checks.
        </p>
        <p className="mt-2">
          Because Kollide is a small project run by three people in their spare time, features may change, and we
          may pause or stop running it. If we stop, we'll give notice in the app or by email where we can.
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
        <h2>Content that isn't allowed</h2>
        <p>
          As required by India's Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules,
          2021, you must not post, share or send anything on Kollide that:
        </p>
        <ul className="mt-2">
          <li>belongs to someone else and that you don't have the right to share;</li>
          <li>
            is obscene, pornographic or paedophilic; invades anyone's privacy, including bodily privacy; insults or
            harasses anyone on the basis of gender; is racially or ethnically objectionable; relates to or encourages
            money laundering or gambling; or promotes enmity between groups on grounds of religion or caste with intent
            to incite violence;
          </li>
          <li>is harmful to children;</li>
          <li>infringes any patent, trademark, copyright or other intellectual property;</li>
          <li>
            deceives or misleads people about where a message came from, or knowingly spreads information that is
            false or misleading;
          </li>
          <li>impersonates another person;</li>
          <li>
            threatens the unity, integrity, defence, security or sovereignty of India, its friendly relations with
            other countries, or public order; incites any cognisable offence; prevents the investigation of any
            offence; or insults any other nation;
          </li>
          <li>contains viruses or any code designed to disrupt, damage or limit any computer system;</li>
          <li>promotes online gambling or betting, or advertises it;</li>
          <li>breaks any law currently in force.</li>
        </ul>
        <p className="mt-2">
          If you do, we may remove the content, suspend or close your account, and, where the law requires, report it
          to the authorities.
        </p>
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
          conversation is reported, we review it, as explained in the Privacy Policy.
        </p>
        <p className="mt-2">
          We cooperate with law enforcement. When we receive a valid legal order or request from a government agency,
          we may share the information it covers, including account details, reports and reported conversations.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own the photos, intro, answers and messages you post. You give us a free, non-exclusive permission to
          store, process and show them to other members, only as needed to run Kollide. This permission ends when you
          delete the content or your account, except for anything we keep as described in the Privacy Policy (for
          example, reported conversations). You're responsible for what you post and confirm you have the right to
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
        <h2>No warranties</h2>
        <p>
          Kollide is provided "as is" and "as available". To the extent the law allows, we make no promises of any
          kind about it: not that it will always be available, secure or error-free, not that the information members
          give about themselves is true, and not that you'll find anyone to go with. Verification only checks that a
          member is a real person who matches their photos.
        </p>
      </section>

      <section>
        <h2>Limits of our responsibility</h2>
        <p>
          You're responsible for your own decisions about whom to talk to and meet, and for your own safety when you
          do. To the extent the law allows:
        </p>
        <ul className="mt-2">
          <li>we aren't liable for what other members say or do, online or offline, including at events;</li>
          <li>
            we aren't liable for indirect or consequential losses, such as lost opportunities, lost data or emotional
            distress, or for losses caused by events outside our reasonable control;
          </li>
          <li>
            because Kollide is free, our total liability to you for all claims relating to Kollide is limited to
            ₹1,000.
          </li>
        </ul>
        <p className="mt-2">
          None of this limits any liability that can't legally be limited, such as for fraud, or any rights you have
          under Indian law that can't be waived.
        </p>
      </section>

      <section>
        <h2>Indemnity</h2>
        <p>
          If you break these terms or the law, or misuse Kollide, and someone makes a claim against us because of it,
          you agree to cover the reasonable losses and costs (including legal fees) that we incur as a result.
        </p>
      </section>

      <section>
        <h2>Complaints and grievances</h2>
        <p>
          To complain about content, a member, or how we've handled your account or data, contact <Contact />. We
          acknowledge every complaint within 24 hours and resolve it within 15 days. If you report content that shows
          you, or someone you represent, in a sexual act or conduct, or with nudity (whole or partial), or that
          impersonates you, including artificially altered images, we'll act to remove or disable access to it within
          24 hours of your report.
        </p>
        <p className="mt-2">For help, questions or feedback, email <Email />. All three of us read that inbox.</p>
      </section>

      <section>
        <h2>Law and disputes</h2>
        <p>
          These terms are governed by the laws of India, and the courts of Bengaluru, Karnataka have jurisdiction.
          Before going to court, please contact us first so we can try to sort it out.
        </p>
      </section>

      <section>
        <h2>General</h2>
        <ul>
          <li>
            <strong>Whole agreement:</strong> these terms and the Privacy Policy are the whole agreement between you
            and us about Kollide.
          </li>
          <li>
            <strong>Severability:</strong> if a court finds any part of these terms unenforceable, that part is
            limited as little as needed, and the rest still applies.
          </li>
          <li>
            <strong>No waiver:</strong> if we don't enforce a term straight away, we can still enforce it later.
          </li>
          <li>
            <strong>Transfer:</strong> we may transfer these terms, and the running of Kollide, to a company or LLP
            that we set up to run it. We'll tell you if we do, and your rights under these terms and the Privacy
            Policy won't be reduced. You can't transfer your account or these terms to anyone else.
          </li>
        </ul>
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
