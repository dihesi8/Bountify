const STEPS = [
  ["Post and fund", "The creator locks the full USDC reward in escrow."],
  ["Apply with proof", "Contributors share past work, and the creator sees their on-chain record."],
  ["Assign", "The creator picks one contributor and the reward is reserved for them."],
  ["Deliver", "The contributor submits a link and a 4-day review clock starts."],
  ["Get paid", "The creator approves, or after 4 days anyone can release payment. Disputes go to the admin."],
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how">
      <h2 id="how" className="text-xl font-semibold">
        How it works
      </h2>
      <ol className="mt-4 grid gap-5 sm:grid-cols-5">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="text-sm">
            <p className="font-medium">
              {i + 1}. {title}
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
