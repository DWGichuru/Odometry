import PhoneFrame from "@/components/landing/PhoneFrame";
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <>
      <header className="nav-bar">
        <div className="wrap">
          <Link href="/" className="brand">
            <span className="mark">
              <Image src="/icons/icon-192x192.png" alt="" width={30} height={30} />
            </span>
            Odometry
          </Link>
          <div className="nav-actions">
            <Link href="/sign-in" className="btn-primary" style={{ height: 40 }}>
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">
              &#x25D0; For Uber &middot; Lyft &middot; DoorDash drivers
            </span>
            <h1 className="display">
              Every shift.<br />
              Every platform.<br />
              <span
                style={{
                  backgroundImage: "var(--platform-gradient)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                One number.
              </span>
            </h1>
            <p className="sub" style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: "30em", marginBottom: 28 }}>
              Log each shift by hand or from a screenshot, and see your hours,
              earnings, trips, and distance combined across every platform.
            </p>
            <div className="cta-row">
              <Link href="/sign-up" className="btn-primary">
                Start free &rarr;
              </Link>
              <a href="#two-ways" className="btn-ghost">
                See how it works
              </a>
            </div>
            <p className="cta-note">Free for your first month. No card required.</p>
          </div>

          <div className="hero-device">
            <div className="float-badge tl">
              <span style={{ color: "var(--success)" }}>&#10003;</span> $1,098 this week
            </div>
            <div className="float-badge br">3 platforms &middot; 1 total</div>
            <PhoneFrame
              src="/screens/dashboard.png"
              alt="Odometry dashboard on a phone"
            />
          </div>
        </div>
      </section>

      <section className="section-block" id="two-ways">
        <div className="wrap-block">
          <div className="section-head center">
            <span className="eyebrow">Log a shift in seconds</span>
            <h2>Three ways to log. Zero spreadsheets.</h2>
            <p>Photograph the odometer and never type a thing, snap the end-of-shift screenshot and let AI read it, or tap the numbers in by hand.</p>
          </div>

          <div className="trio">
            <div className="way headline">
              <span className="tag live">Headline feature</span>
              <h3>Live, hands-free</h3>
              <p>Photograph the odometer to start a shift. Photograph it again to end one. No typing, no timer to remember &mdash; the app timestamps everything for you.</p>
              <PhoneFrame
                src="/screens/capture.png"
                alt="Live odometer capture screen"
              />
            </div>

            <div className="way">
              <span className="tag">Or from a screenshot</span>
              <h3>From a screenshot</h3>
              <p>Upload your earnings summary. GPT-4o mini extracts earnings, trips, distance, and the end odometer for you to review.</p>
              <PhoneFrame
                src="/screens/import.png"
                alt="Screenshot import screen"
              />
            </div>

            <div className="way">
              <span className="tag">Or by hand</span>
              <h3>Type it in</h3>
              <p>One clean form: date, platform, times, earnings, trips. No odometer? Switch to distance and it back-calculates.</p>
              <PhoneFrame
                src="/screens/new-shift.png"
                alt="Manual shift entry form"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap-block">
          <div className="split">
            <PhoneFrame
              src="/screens/shifts.png"
              alt="Shift history across Uber, Lyft and DoorDash"
            />
            <div>
              <span className="eyebrow">One place</span>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "12px 0 10px" }}>
                Three apps. One honest total.
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 17 }}>
                Every shift lands in one list, colour-coded by platform, with your
                real hourly rate on each. Stop tab-hopping between apps to add up
                your week.
              </p>
              <ul className="feature-list">
                <li>
                  <span className="ic" style={{ color: "var(--uber)" }}>&#9679;</span>
                  <div>
                    <h4>Uber, Lyft &amp; DoorDash side by side</h4>
                    <p>One combined view of hours, earnings, trips, and kilometres.</p>
                  </div>
                </li>
                <li>
                  <span className="ic" style={{ color: "var(--lyft)" }}>&#9679;</span>
                  <div>
                    <h4>Your real rate, per shift</h4>
                    <p>See dollars per hour the moment a shift is logged.</p>
                  </div>
                </li>
                <li>
                  <span className="ic" style={{ color: "var(--doordash)" }}>&#9679;</span>
                  <div>
                    <h4>Edit or delete anytime</h4>
                    <p>Fix a number in a tap; your totals update instantly.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap-block">
          <div className="split rev">
            <div>
              <span className="eyebrow">Track your progress</span>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "12px 0 10px" }}>
                Watch your real rate climb.
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 17 }}>
                Every shift feeds your trends. See earnings per hour, per trip, and
                per kilometre week over week, so you know which days and platforms
                actually pay, and whether you are getting better.
              </p>
              <ul className="feature-list">
                <li>
                  <span className="ic" style={{ color: "var(--accent)" }}>&#9679;</span>
                  <div>
                    <h4>Rates over time</h4>
                    <p>Per hour, per trip, and per km, charted week by week.</p>
                  </div>
                </li>
                <li>
                  <span className="ic" style={{ color: "var(--warning)" }}>&#9679;</span>
                  <div>
                    <h4>Spot your best weeks</h4>
                    <p>Totals for earnings, hours, trips, and distance at a glance.</p>
                  </div>
                </li>
                <li>
                  <span className="ic" style={{ color: "var(--success)" }}>&#9679;</span>
                  <div>
                    <h4>Week or month view</h4>
                    <p>Zoom out to see the bigger picture of your driving.</p>
                  </div>
                </li>
              </ul>
            </div>
            <PhoneFrame
              src="/screens/trends.png"
              alt="Trends: earnings per hour, trip and km over six weeks"
            />
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap-block">
          <div className="split">
            <PhoneFrame
              src="/screens/export.png"
              alt="Export screen with a period picker, totals, and PDF/CSV downloads"
            />
            <div>
              <span className="eyebrow">Tax season, sorted</span>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "12px 0 10px" }}>
                Every shift, ready for your accountant.
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 17 }}>
                Pick a month, a year, or a custom range and get a clean record of
                everything you drove and earned &mdash; no more digging through
                three apps at tax time.
              </p>
              <ul className="feature-list">
                <li>
                  <span className="ic" style={{ color: "var(--accent)" }}>&#9679;</span>
                  <div>
                    <h4>PDF summary or CSV</h4>
                    <p>A one-page totals sheet, or a row-by-row CSV for your spreadsheet.</p>
                  </div>
                </li>
                <li>
                  <span className="ic" style={{ color: "var(--success)" }}>&#9679;</span>
                  <div>
                    <h4>Any period you need</h4>
                    <p>Month, calendar year, or a custom date range.</p>
                  </div>
                </li>
                <li>
                  <span className="ic" style={{ color: "var(--warning)" }}>&#9679;</span>
                  <div>
                    <h4>Every shift, every source</h4>
                    <p>Manual, screenshot, and odometer-captured shifts all included.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="wrap-block">
          <div className="section-head center">
            <span className="eyebrow">Pricing</span>
            <h2>One plan. Fair price.</h2>
            <p>Try everything free for a month. Keep going for less than one delivery tip.</p>
          </div>
          <div className="price-wrap">
            <div className="price-card">
              <div className="ribbon">Free for your first month</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Pro</h3>
              <div className="price-amount">
                $3.99<small>/mo</small>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                after your free month &middot; cancel anytime
              </div>
              <ul className="price-list">
                <li>
                  <span style={{ color: "var(--success)", fontWeight: 800 }}>&#10003;</span>{" "}
                  Unlimited shifts across Uber, Lyft &amp; DoorDash
                </li>
                <li>
                  <span style={{ color: "var(--success)", fontWeight: 800 }}>&#10003;</span>{" "}
                  Screenshot import with AI stat extraction
                </li>
                <li>
                  <span style={{ color: "var(--success)", fontWeight: 800 }}>&#10003;</span>{" "}
                  Trends: earnings per hour, per trip, per km
                </li>
                <li>
                  <span style={{ color: "var(--success)", fontWeight: 800 }}>&#10003;</span>{" "}
                  Combined totals for any day, week, or platform
                </li>
              </ul>
              <Link
                href="/sign-up"
                className="btn-primary"
                style={{ width: "100%" }}
              >
                Start free &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="final">
        <div className="wrap-block">
          <h2>Know what you actually earn.</h2>
          <p>Log your first shift in under a minute.</p>
          <Link href="/sign-up" className="btn-primary">
            Start free &rarr;
          </Link>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "28px 0" }}>
        <div className="wrap-block" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--muted)", flexWrap: "wrap", gap: 12 }}>
          <span className="brand" style={{ fontSize: 14 }}>
            <span className="mark" style={{ width: 24, height: 24 }}>
              <Image src="/icons/icon-192x192.png" alt="" width={24} height={24} />
            </span>
            Odometry
          </span>
          <nav>
            <Link href="#" style={{ color: "var(--text-secondary)", marginLeft: 18 }}>Privacy</Link>
            <Link href="#" style={{ color: "var(--text-secondary)", marginLeft: 18 }}>Terms</Link>
            <Link href="/sign-in" style={{ color: "var(--text-secondary)", marginLeft: 18 }}>Sign in</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
