/**
 * The cross-tab handoff after checkout.
 *
 * The rule that matters: the checkout tab may only close itself once another
 * tab has confirmed it heard about the new plan. Close without an ack and you
 * shut the only window showing the result.
 *
 * Node has a real BroadcastChannel, and it has the same "never delivers to its
 * own sender" semantics as the browser, so these exercise the real protocol
 * rather than a mock of it.
 */
import { describe, it, expect, vi } from "vitest";
import { createPlanSync } from "./planSync";

// Two independent "tabs" in one process.
const tabA = createPlanSync("tab-a");
const tabB = createPlanSync("tab-b");
const tabC = createPlanSync("tab-c");

describe("plan sync handshake", () => {
  it("tells a listening tab to refetch", async () => {
    const onChange = vi.fn();
    const stop = tabA.listen(onChange);

    await tabB.announce(500);

    expect(onChange).toHaveBeenCalledOnce();
    stop();
  });

  it("resolves true once a listener acks — the tab may close", async () => {
    const stop = tabA.listen(() => {});
    await expect(tabB.announce(500)).resolves.toBe(true);
    stop();
  });

  it("resolves false when nothing is listening — the tab must stay open", async () => {
    // No listener at all: closing here would strand the user with no window
    // showing that their payment went through.
    await expect(tabB.announce(150)).resolves.toBe(false);
  });

  it("resolves false when the only listener has gone away", async () => {
    const stop = tabA.listen(() => {});
    stop();
    await expect(tabB.announce(150)).resolves.toBe(false);
  });

  it("does not ack its own announcement", async () => {
    // If a sender could hear itself, a lone checkout tab would ack its own
    // message and close, which is the exact failure the ack exists to prevent.
    const onChange = vi.fn();
    const stop = tabA.listen(onChange);

    // The SAME tab announces; its own listener must not fire or ack.
    const heard = await tabA.announce(150);

    expect(onChange).not.toHaveBeenCalled();
    expect(heard).toBe(false);
    stop();
  });

  it("wakes every open tab, not just the first", async () => {
    const a = vi.fn(); const b = vi.fn();
    const stopA = tabA.listen(a);
    const stopB = tabB.listen(b);

    await tabC.announce(500);

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    stopA(); stopB();
  });
});
