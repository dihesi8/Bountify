import { Suspense } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { ConnectButton } from "@/components/ConnectButton";
import { CreateJobForm } from "@/components/CreateJobForm";
import { StatsStrip } from "@/components/StatsStrip";
import { TaskFeed } from "@/components/TaskFeed";
import { Reveal } from "@/components/Reveal";

const process = [
  ["01", "Fund the brief", "Post a clear task and lock its full USDC reward in escrow before anyone starts."],
  ["02", "Choose your person", "Contributors apply with proof of work. Review their on-chain track record and pick a fit."],
  ["03", "Make the work", "Your reward is reserved for the selected contributor while they build and deliver."],
  ["04", "Release with confidence", "Approve the work to pay instantly, or let the four-day review clock trigger an open release."],
];

const mechanics = [
  ["01", "Money is there first", "Every listing is fully funded. No empty promises, no chasing an invoice after the work is done."],
  ["02", "Clear time limits", "Each task has a delivery deadline. Submitted work starts a four-day review window."],
  ["03", "A way through disputes", "Either side can raise a dispute. An admin decides the escrow split, with a 50/50 fallback after 14 days."],
  ["04", "Safety exits", "Creators can cancel unassigned tasks or reclaim missed deadlines. Contributors can withdraw before assignment."],
];

export default function Home() {
  return (
    <main className="site-shell">
      <div className="hero-wrap" id="top">
        <header className="topbar">
          <a className="wordmark" href="#top" aria-label="Bountify home">B<span>●</span>UNTIFY</a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#marketplace">Bounties</a><a href="#how-it-works">How it works</a><a href="#mechanics">Mechanics</a><a href="#about">About</a>
          </nav>
          <Suspense fallback={<span className="wallet-placeholder">Wallet</span>}><ConnectButton /></Suspense>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><span className="live-dot" /> THE WORK-FIRST BOUNTY MARKETPLACE</p>
            <h1 id="hero-title">MAKE<br />GOOD<br /><span>THINGS.</span></h1>
            <p className="hero-lede">Great work deserves a real reward. Find your next challenge, or fund the brief before a single line gets written.</p>
            <div className="hero-actions"><a className="button button-light" href="#marketplace">Explore bounties <span aria-hidden="true">↗</span></a><a className="text-link hero-link" href="#post-a-task">Post a task <span aria-hidden="true">↓</span></a></div>
            <div className="hero-footnote"><span>BUILT ON ARC</span><span>•</span><span>PAID IN USDC</span><span>•</span><span>FUNDED UP FRONT</span></div>
          </div>
          <div className="hero-art" role="img" aria-label="Creative team collaborating around a table">
            <div className="art-glow" /><div className="art-frame" />
            <div className="art-caption"><span>IDEAS IN MOTION</span><span>001 / BOUNTIFY</span></div>
            <div className="hero-stamp">B<br />/F</div>
          </div>
          <a className="scroll-cue" href="#proof"><span /> SCROLL TO EXPLORE</a>
        </section>
      </div>

      <section id="proof" className="proof-band" aria-label="Marketplace statistics">
        <div className="proof-intro"><span className="eyebrow">REAL REWARDS, ON-CHAIN</span><p>Every number comes<br />straight from the chain.</p></div>
        <Suspense fallback={<div className="stats-fallback">Loading marketplace activity…</div>}><StatsStrip /></Suspense>
        <span className="proof-index">ARC MAINNET<br />CHAIN 5042</span>
      </section>

      <Reveal><section id="how-it-works" className="section process-section">
        <div className="section-heading"><div><p className="eyebrow dark-eyebrow">01 — THE FLOW</p><h2>FROM BRIEF<br />TO <span>BOUNTY.</span></h2></div><p className="section-intro">A simple path from a good idea to good work, with the reward accounted for at every step.</p></div>
        <div className="process-grid">{process.map(([number, title, text]) => <article className="process-step" key={number}><span className="step-number">{number}</span><span className="step-rule" /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section></Reveal>

      <section id="marketplace" className="market-section">
        <Reveal><div className="section-heading market-heading"><div><p className="eyebrow">02 — THE OPEN CALL</p><h2>WORK THAT’S<br /><span>WORTH IT.</span></h2></div><p className="section-intro">Browse funded work from people ready to build. Pick your lane, show what you can do, and make your next move.</p></div></Reveal>
        <div className="market-toolbar"><span className="market-live"><span className="live-dot" /> LIVE ON ARC</span><a className="button button-outline" href="#post-a-task">Have a brief? Post it <span aria-hidden="true">↗</span></a></div>
        <Suspense fallback={<p className="loading-feed">Loading funded bounties…</p>}><TaskFeed /></Suspense>
      </section>

      <Reveal><section id="mechanics" className="mechanics-section">
        <div className="mechanics-heading"><p className="eyebrow">03 — THE MECHANICS</p><h2>THE RULES<br />ARE <span>THE POINT.</span></h2><p>Built to give both sides a clearer deal from day one.</p></div>
        <div className="mechanics-list">{mechanics.map(([number, title, text]) => <article className="mechanic-row" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section></Reveal>

      <Reveal><section id="about" className="about-section">
        <div className="about-mark" aria-hidden="true">B<span>●</span></div><div className="about-copy"><p className="eyebrow dark-eyebrow">04 — WHY BOUNTIFY</p><h2>LESS “TRUST ME.”<br />MORE <span>“IT’S FUNDED.”</span></h2><p>Bountify is a marketplace for work that starts with the money already in place. Creators get committed contributors; contributors get the confidence to do their best work.</p><p>Every task, application and payout is recorded on Arc. Your reputation grows with the work you finish.</p><a className="text-link dark-link" href="#marketplace">Find your first bounty <span aria-hidden="true">↗</span></a></div>
      </section></Reveal>

      <Reveal><section id="safety" className="safety-section">
        <div><p className="eyebrow">05 — BUILT WITH GUARDRAILS</p><h2>GOOD WORK.<br /><span>BETTER TERMS.</span></h2><p className="safety-intro">Transparent rules keep the whole process moving and give each side a fair next step.</p></div>
        <div className="guardrail-grid"><article><span>01</span><h3>Fully funded</h3><p>The full reward is held in escrow before a contributor is assigned.</p></article><article><span>02</span><h3>Automatic release</h3><p>After four review days, anyone can release payment to the contributor.</p></article><article><span>03</span><h3>Visible history</h3><p>Settled work creates an on-chain record of earnings and completion.</p></article></div>
        <p className="safety-note">Bountify is unaudited and has a 25 USDC per-task deposit cap. Treat it as an early project, and don’t put significant funds in escrow.</p>
      </section></Reveal>

      <Reveal><section id="post-a-task" className="post-section">
        <div className="post-copy"><p className="eyebrow dark-eyebrow">06 — START SOMETHING</p><h2>GOT A BRIEF?<br /><span>BACK IT UP.</span></h2><p>Set the scope, choose a delivery window, and put the reward in escrow. The right person can take it from there.</p><div className="post-detail"><span>01</span><p>From 1 to 25 USDC per task</p></div><div className="post-detail"><span>02</span><p>Delivery windows from 1 to 90 days</p></div></div>
        <div className="post-form-wrap"><Suspense fallback={<p>Loading wallet…</p>}><CreateJobForm /></Suspense></div>
      </section></Reveal>

      <Reveal><section id="faq" className="faq-section">
        <div className="faq-heading"><p className="eyebrow dark-eyebrow">07 — THE SHORT VERSION</p><h2>GOOD TO<br /><span>KNOW.</span></h2></div>
        <div className="faq-list"><details><summary>Is the bounty really funded before work starts?</summary><p>Yes. A creator deposits the full reward into the escrow contract when posting a task. Unfunded listings can’t be created.</p></details><details><summary>What happens if a creator goes quiet?</summary><p>After the four-day review period, anyone can trigger the automatic release of the reward to the contributor.</p></details><details><summary>What if the work is disputed?</summary><p>Either the creator or assigned contributor can open a dispute with a small USDC bond. The admin can split the escrow; if there’s no decision for 14 days, anyone can force a 50/50 split.</p></details><details><summary>Which network and token does Bountify use?</summary><p>Bountify is deployed on Arc mainnet. Rewards and gas use USDC.</p></details></div>
      </section></Reveal>

      <Reveal><section className="closing-cta"><p className="eyebrow">THE NEXT GOOD THING STARTS HERE</p><h2>LET’S MAKE<br /><span>IT COUNT.</span></h2><a className="button button-light" href="#marketplace">Find your bounty <span aria-hidden="true">↗</span></a><span className="cta-decoration" aria-hidden="true">B.</span></section></Reveal>

      <Suspense fallback={null}><div className="admin-wrap"><AdminPanel /></div></Suspense>
      <footer className="footer"><a className="wordmark" href="#top">B<span>●</span>UNTIFY</a><p>Fund the work. Back the people who make it.</p><div><a href="#how-it-works">How it works</a><a href="#mechanics">Mechanics</a><a href="#faq">FAQ</a><a href="#top">Back to top ↑</a></div><small>ON ARC · PAID IN USDC · BUILT FOR PEOPLE WHO BUILD</small></footer>
    </main>
  );
}
