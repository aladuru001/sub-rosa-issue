// Copyright (c) 2026 Sub Rosa contributors
// ObserverView must never render a sealed bid amount before the shared
// round-phase helper says reveal has opened (issue #392).
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createFakeTime } from "@sub-rosa/time";

import { DEMO_TRACE, type DemoTrace } from "../demo/trace";
import { timeOfRound, QUICKNET_GENESIS, QUICKNET_PERIOD } from "../lib/countdown";
import { TimeProvider } from "../lib/time";
import { ObserverView } from "./ObserverView";

// A sentinel bid amount distinct from any bidder's public escrow figure in
// DEMO_TRACE, so the assertion can't accidentally match the (always-public)
// escrow column instead of the (phase-gated) revealed-bid column.
const SEALED_BID_USDC = 123_456.78;
const LEAKED_BID = "123,456.78"; // usdc(123456.78)

function commitPhaseTrace(): DemoTrace {
  return {
    ...DEMO_TRACE,
    // Reveal round pushed far into the future so Drand has not published it
    // either — both signals the phase helper reads agree: still sealed.
    meta: { ...DEMO_TRACE.meta, roundStatus: "Open", revealRound: 99_999_999 },
    bidders: DEMO_TRACE.bidders.map((b) => ({ ...b, bidUsdc: SEALED_BID_USDC, revealed: false })),
  };
}

function revealPhaseTrace(): DemoTrace {
  return {
    ...DEMO_TRACE,
    meta: { ...DEMO_TRACE.meta, roundStatus: "Settled" },
    bidders: DEMO_TRACE.bidders.map((b) => ({ ...b, bidUsdc: SEALED_BID_USDC, revealed: true })),
  };
}

function render(trace: DemoTrace, nowMs: number): string {
  const fake = createFakeTime(nowMs);
  return renderToStaticMarkup(
    <TimeProvider value={fake}>
      <ObserverView trace={trace} live={null} expectLive={false} />
    </TimeProvider>,
  );
}

test("commit-phase fixture does not render the fixture bid amount", () => {
  const trace = commitPhaseTrace();
  const nowMs = timeOfRound(1) * 1000; // long before the fixture's reveal round
  const html = render(trace, nowMs);

  assert.doesNotMatch(html, new RegExp(LEAKED_BID));
  assert.match(html, /sealed/);
});

test("reveal-phase fixture does render the bid amount", () => {
  const trace = revealPhaseTrace();
  const nowMs = (QUICKNET_GENESIS + QUICKNET_PERIOD * trace.meta.revealRound + 1) * 1000;
  const html = render(trace, nowMs);

  assert.match(html, new RegExp(LEAKED_BID));
  assert.doesNotMatch(html, />sealed</);
});

test("renders without a wallet or live connection (trace-only Evidence mode)", () => {
  const html = render(revealPhaseTrace(), Date.now());
  assert.match(html, /Observer view/);
});
