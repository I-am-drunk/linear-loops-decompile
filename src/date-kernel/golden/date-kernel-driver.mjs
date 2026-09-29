// Hand-written drive-mode driver for core.PJIFv7xf.js (DATE-KERNEL claim,
// #225 2026-09-29; original code). Drives the boot-installed ambient date
// library: `entry.$` is `fe` (pretty L297–344), the installer html.CjyPLfH8's
// `b()` calls at boot — the ONLY consumer of this export in all 1,550 chunks.
// The driver calls `entry.$()` and then exercises the installed
// Date.prototype / String.prototype methods, exactly as transcribed chunks
// do. Zero stubs: all 14 closure chunks (spacetime included) execute REAL.
//
// The clean-module test (../date-kernel.test.ts) imports THIS driver and
// passes `{ entry: { $: installDateKernel } }`, so the fixture set is
// byte-identical by construction on both sides of the comparison.
//
// Every date fixture is constructed from explicit local-time fields under a
// pinned process TZ (set per block, restored at the end): the plain branch
// of the kernel is LOCAL-clock arithmetic, so the golden pins behavior in
// both an all-UTC world and a DST-observing zone (America/New_York, fall
// back 2026-11-01, spring forward 2026-03-08). Node on linux re-reads
// process.env.TZ for new Date operations; CI and sandboxes are linux.
//
// Value facts pinned (merged R-BOOT §2 row, docs/remap/sections/boot-config.md):
//   1. offsetByDays ≠ offsetByHours(24) across a DST boundary (setDate vs
//      epoch-ms) — and equal away from one.
//   2. toLocalDate's invalid-date recursion strips ONE trailing char at a
//      time until parse; empty string → `new Date` (projected as a
//      within-5s-of-now boolean, the only non-instant fact here).
//   3. nearestMidnight's no-tz fork is literally offsetByHours(12).midnight().
//   4. offsetByBusinessDays validation: both exact throw strings, the
//      whole-week skip, the zero-offset same-instance return.
//   5. toTimelessDate zero-padding; daysTo local-calendar-day counting
//      across DST and negative spans; toUTCDate field shift.
export default async ({ entry }) => {
  const install = entry.$;
  install();

  const savedTZ = process.env.TZ;
  const out = {};

  const iso = (d) => d.toISOString();

  // ---- Block 1: UTC world (no DST) ----
  process.env.TZ = `UTC`;
  {
    const base = new Date(2026, 5, 15, 17, 30, 45, 123); // 2026-06-15 17:30:45.123 local
    out.utc = {
      midnight: iso(base.midnight()),
      nearestMidnightPM: iso(base.nearestMidnight()),
      nearestMidnightAM: iso(new Date(2026, 5, 15, 3, 0, 0, 0).nearestMidnight()),
      offsetByDaysPlus3: iso(base.offsetByDays(3)),
      offsetByDaysMinus40: iso(base.offsetByDays(-40)),
      offsetByHours25: iso(base.offsetByHours(25)),
      offsetBySeconds90: iso(base.offsetBySeconds(90)),
      toUTCDate: iso(base.toUTCDate()), // zero shift in UTC
      toTimelessDate: base.toTimelessDate(),
      toTimelessDatePadded: new Date(2026, 0, 5).toTimelessDate(), // 2026-01-05
      daysToNextYear: base.daysTo(new Date(2027, 0, 1)),
      daysToNegative: base.daysTo(new Date(2026, 5, 1)),
      daysToSameDayLateNight: new Date(2026, 5, 15, 0, 0, 1).daysTo(new Date(2026, 5, 15, 23, 59, 59)),
    };
  }

  // ---- Block 2: DST-observing zone (America/New_York) ----
  process.env.TZ = `America/New_York`;
  {
    // Fall back: Sun 2026-11-01 02:00 EDT → 01:00 EST (a 25-hour day).
    const beforeFallBack = new Date(2026, 9, 31, 18, 0, 0, 0); // Sat Oct 31 18:00 EDT
    const byDay = beforeFallBack.offsetByDays(1);
    const byHours = beforeFallBack.offsetByHours(24);
    // Spring forward: Sun 2026-03-08 02:00 EST → 03:00 EDT (a 23-hour day).
    const beforeSpring = new Date(2026, 2, 7, 18, 0, 0, 0); // Sat Mar 7 18:00 EST
    const springByDay = beforeSpring.offsetByDays(1);
    const springByHours = beforeSpring.offsetByHours(24);
    // Away from DST: the two arithmetics agree.
    const calm = new Date(2026, 6, 10, 9, 15, 0, 0);
    out.newYork = {
      fallBackByDay: iso(byDay),
      fallBackByHours: iso(byHours),
      fallBackDiverge: byDay.getTime() !== byHours.getTime(),
      springByDay: iso(springByDay),
      springByHours: iso(springByHours),
      springDiverge: springByDay.getTime() !== springByHours.getTime(),
      calmAgree: calm.offsetByDays(1).getTime() === calm.offsetByHours(24).getTime(),
      midnightOnFallBackDay: iso(new Date(2026, 10, 1, 18, 0, 0, 0).midnight()),
      nearestMidnightAcrossFallBack: iso(new Date(2026, 9, 31, 20, 0, 0, 0).nearestMidnight()),
      toUTCDateShift: iso(new Date(2026, 9, 31, 18, 0, 0, 0).toUTCDate()),
      daysToAcrossFallBack: new Date(2026, 9, 30, 12, 0).daysTo(new Date(2026, 10, 3, 12, 0)),
      daysToAcrossSpring: new Date(2026, 2, 6, 23, 0).daysTo(new Date(2026, 2, 9, 1, 0)),
      toTimelessDateLocal: new Date(2026, 10, 1, 0, 30).toTimelessDate(),
    };

    // Business days (getDay numbers: 0=Sun … 6=Sat), Mon–Fri workweek.
    const monFri = [1, 2, 3, 4, 5];
    const friday = new Date(2026, 9, 30, 10, 0, 0, 0); // Fri Oct 30 2026
    const zeroOffset = friday.offsetByBusinessDays(0, monFri);
    const throwMessage = (fn) => {
      try {
        fn();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    };
    out.businessDays = {
      fridayPlus1: iso(friday.offsetByBusinessDays(1, monFri)), // Mon Nov 2 (across fall back)
      fridayPlus10: iso(friday.offsetByBusinessDays(10, monFri)), // two whole weeks
      fridayMinus6: iso(friday.offsetByBusinessDays(-6, monFri)),
      mondayOnlyPlus3: iso(friday.offsetByBusinessDays(3, [1])), // week-skip path, single workday
      zeroOffsetIsSameInstance: zeroOffset === friday,
      emptyWorkDaysThrow: throwMessage(() => friday.offsetByBusinessDays(1, [])),
      outOfRangeWorkDayThrow: throwMessage(() => friday.offsetByBusinessDays(1, [7])),
      offsetOutOfBoundsThrow: throwMessage(() => friday.offsetByBusinessDays(10000001, monFri)),
      // Bound check is strict >: the permitted maximum itself must succeed
      // (whole-week skip makes it cheap: ~2e6 weeks in one setDate call).
      offsetAtBoundExact: iso(friday.offsetByBusinessDays(10000000, monFri)),
    };

    // String#toLocalDate: parse → local midnight of the parsed UTC calendar
    // day; invalid → strip one trailing char and recurse; empty → now.
    const nowProbe = ``.toLocalDate();
    out.toLocalDate = {
      isoWithTime: iso(`2026-05-04T22:30:00Z`.toLocalDate()), // UTC day May 4 → local May 4 midnight EDT
      dateOnly: iso(`2026-05-04`.toLocalDate()),
      trailingGarbageOneChar: iso(`2026-05-04T10:00:00Zx`.toLocalDate()),
      trailingGarbageManyChars: iso(`2026-05-04T10:00:00Z@@@@`.toLocalDate()),
      // Strip ORDER fact: "2026-01-31abc" strips to "2026-01-31" (a parse
      // success) before ever reaching "2026-01-3" (a different date).
      stripStopsAtFirstParse: iso(`2026-01-31abc`.toLocalDate()),
      emptyStringIsNow: Math.abs(nowProbe.getTime() - Date.now()) < 5000,
    };
  }

  if (savedTZ === undefined) delete process.env.TZ;
  else process.env.TZ = savedTZ;
  return out;
};
