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
