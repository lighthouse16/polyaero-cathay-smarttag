import { afterEach, expect, it, vi } from "vitest";
import { cachedRead, clearReadCache } from "../src/lib/readCache";

afterEach(() => { clearReadCache(); vi.restoreAllMocks(); });

it("coalesces concurrent reads and isolates upstream keys", async () => {
  const load = vi.fn(async () => ({ status: "TAGGED" }));
  const [a, b] = await Promise.all([
    cachedRead("a", 15_000, load), cachedRead("a", 15_000, load),
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(a).toBe(b);
  await cachedRead("b", 15_000, load);
  expect(load).toHaveBeenCalledTimes(2);
});

it("does not cache failures or serve previous success after invalidation", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("HTTP 401"))
    .mockResolvedValueOnce("old").mockResolvedValueOnce("updated");
  await expect(cachedRead("a", 15_000, load)).rejects.toThrow("HTTP 401");
  expect(await cachedRead("a", 15_000, load)).toBe("old");
  clearReadCache();
  expect(await cachedRead("a", 15_000, load)).toBe("updated");
});

it("force-fresh replaces cached data and expiry never serves stale on failure", async () => {
  let clock = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const load = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new")
    .mockRejectedValueOnce(new Error("HTTP 503"));
  expect(await cachedRead("a", 15_000, load)).toBe("old");
  expect(await cachedRead("a", 15_000, load, true)).toBe("new");
  expect(await cachedRead("a", 15_000, load)).toBe("new");
  clock += 15_001;
  await expect(cachedRead("a", 15_000, load)).rejects.toThrow("HTTP 503");
});

it("late rejected reads cannot evict newer fresh results", async () => {
  let rejectOld!: (reason: Error) => void;
  const old = cachedRead("a", 15_000, () => new Promise<string>((_, reject) => { rejectOld = reject; }));
  const rejected = expect(old).rejects.toThrow("old request failed");
  await Promise.resolve();
  expect(await cachedRead("a", 15_000, async () => "new", true)).toBe("new");
  rejectOld(new Error("old request failed"));
  await rejected;
  const unused = vi.fn(async () => "unexpected");
  expect(await cachedRead("a", 15_000, unused)).toBe("new");
  expect(unused).not.toHaveBeenCalled();
});

it("late resolved reads cannot repopulate cache after invalidation", async () => {
  let resolveOld!: (value: string) => void;
  const old = cachedRead("a", 15_000, () => new Promise<string>((resolve) => { resolveOld = resolve; }));
  await Promise.resolve();
  clearReadCache();
  expect(await cachedRead("a", 15_000, async () => "updated")).toBe("updated");
  resolveOld("old");
  expect(await old).toBe("old");
  expect(await cachedRead("a", 15_000, async () => "unexpected")).toBe("updated");
});

it("bounds retained keys to 128 entries", async () => {
  for (let i = 0; i < 129; i++) await cachedRead(String(i), 15_000, async () => i);
  const load = vi.fn(async () => 0);
  await cachedRead("0", 15_000, load);
  expect(load).toHaveBeenCalledOnce();
});
