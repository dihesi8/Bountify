import { Suspense } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { ConnectButton } from "@/components/ConnectButton";
import { CreateJobForm } from "@/components/CreateJobForm";
import { HowItWorks } from "@/components/HowItWorks";
import { StatsStrip } from "@/components/StatsStrip";
import { TaskFeed } from "@/components/TaskFeed";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Bountify</h1>
        <Suspense fallback={null}>
          <ConnectButton />
        </Suspense>
      </div>
      <p className="mt-2 max-w-prose text-zinc-600 dark:text-zinc-400">
        Every reward is locked in USDC escrow before work starts, so contributors know the money is there.
      </p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <StatsStrip />
        </Suspense>
      </div>
      <div className="mt-10">
        <HowItWorks />
      </div>
      <div className="mt-10">
        <Suspense fallback={null}>
          <CreateJobForm />
        </Suspense>
      </div>
      <div className="mt-10">
        <Suspense fallback={<p className="text-zinc-500">Loading tasks…</p>}>
          <TaskFeed />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <AdminPanel />
      </Suspense>
    </main>
  );
}
