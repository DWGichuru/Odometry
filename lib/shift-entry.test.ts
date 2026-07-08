import { describe, expect, it } from "vitest";
import { Platform } from "@/types/shift";
import {
  buildShift,
  getShiftHours,
  isValid,
  validateShiftEntry,
} from "@/lib/shift-entry";
import type { ShiftFormData } from "@/lib/shift-entry";

function validEntry(overrides: Partial<ShiftFormData> = {}): ShiftFormData {
  return {
    date: "2025-07-08",
    platform: Platform.UBER,
    startTime: "18:00",
    endTime: "22:30",
    amountEarned: "150.00",
    tripsCompleted: "12",
    odoMode: "odometer",
    startOdometer: "45000",
    distance: "",
    endOdometer: "45128",
    ...overrides,
  };
}

describe("validateShiftEntry", () => {
  it("returns no errors for valid odometer-mode entry", () => {
    expect(validateShiftEntry(validEntry())).toEqual({});
  });

  it("returns no errors for valid distance-mode entry", () => {
    expect(
      validateShiftEntry(
        validEntry({ odoMode: "distance", startOdometer: "", distance: "128" }),
      ),
    ).toEqual({});
  });

  it("requires date", () => {
    expect(validateShiftEntry(validEntry({ date: "" }))).toHaveProperty("date");
  });

  it("requires startTime", () => {
    expect(
      validateShiftEntry(validEntry({ startTime: "" })),
    ).toHaveProperty("startTime");
  });

  it("requires endTime", () => {
    expect(validateShiftEntry(validEntry({ endTime: "" }))).toHaveProperty(
      "endTime",
    );
  });

  it("requires amountEarned", () => {
    expect(
      validateShiftEntry(validEntry({ amountEarned: "" })),
    ).toHaveProperty("amountEarned");
  });

  it("rejects negative amountEarned", () => {
    expect(
      validateShiftEntry(validEntry({ amountEarned: "-5" })),
    ).toHaveProperty("amountEarned", "Must be 0 or more");
  });

  it("allows zero amountEarned", () => {
    expect(
      validateShiftEntry(validEntry({ amountEarned: "0" })),
    ).not.toHaveProperty("amountEarned");
  });

  it("requires tripsCompleted", () => {
    expect(
      validateShiftEntry(validEntry({ tripsCompleted: "" })),
    ).toHaveProperty("tripsCompleted");
  });

  it("rejects non-integer tripsCompleted", () => {
    expect(
      validateShiftEntry(validEntry({ tripsCompleted: "3.5" })),
    ).toHaveProperty("tripsCompleted");
  });

  it("rejects negative tripsCompleted", () => {
    expect(
      validateShiftEntry(validEntry({ tripsCompleted: "-1" })),
    ).toHaveProperty("tripsCompleted");
  });

  it("allows zero tripsCompleted", () => {
    expect(
      validateShiftEntry(validEntry({ tripsCompleted: "0" })),
    ).not.toHaveProperty("tripsCompleted");
  });

  it("requires endOdometer", () => {
    expect(
      validateShiftEntry(validEntry({ endOdometer: "" })),
    ).toHaveProperty("endOdometer");
  });

  it("rejects negative endOdometer", () => {
    expect(
      validateShiftEntry(validEntry({ endOdometer: "-1" })),
    ).toHaveProperty("endOdometer", "Must be 0 or more");
  });

  describe("odometer mode", () => {
    it("requires startOdometer", () => {
      expect(
        validateShiftEntry(
          validEntry({ odoMode: "odometer", startOdometer: "" }),
        ),
      ).toHaveProperty("startOdometer");
    });

    it("rejects negative startOdometer", () => {
      expect(
        validateShiftEntry(
          validEntry({ odoMode: "odometer", startOdometer: "-100" }),
        ),
      ).toHaveProperty("startOdometer", "Must be 0 or more");
    });

    it("rejects startOdometer >= endOdometer", () => {
      expect(
        validateShiftEntry(
          validEntry({
            odoMode: "odometer",
            startOdometer: "45128",
            endOdometer: "45128",
          }),
        ),
      ).toHaveProperty("startOdometer", "Must be less than end odometer");
    });
  });

  describe("distance mode", () => {
    it("requires distance", () => {
      expect(
        validateShiftEntry(
          validEntry({ odoMode: "distance", startOdometer: "", distance: "" }),
        ),
      ).toHaveProperty("distance");
    });

    it("rejects zero distance", () => {
      expect(
        validateShiftEntry(
          validEntry({ odoMode: "distance", startOdometer: "", distance: "0" }),
        ),
      ).toHaveProperty("distance", "Must be more than 0");
    });

    it("rejects negative distance", () => {
      expect(
        validateShiftEntry(
          validEntry({
            odoMode: "distance",
            startOdometer: "",
            distance: "-10",
          }),
        ),
      ).toHaveProperty("distance", "Must be more than 0");
    });

    it("rejects distance > endOdometer", () => {
      expect(
        validateShiftEntry(
          validEntry({
            odoMode: "distance",
            startOdometer: "",
            endOdometer: "50",
            distance: "100",
          }),
        ),
      ).toHaveProperty("distance", "Cannot exceed end odometer");
    });

    it("does not require startOdometer in distance mode", () => {
      const errors = validateShiftEntry(
        validEntry({ odoMode: "distance", startOdometer: "", distance: "128" }),
      );
      expect(errors).not.toHaveProperty("startOdometer");
    });
  });
});

describe("isValid", () => {
  it("returns true for empty errors", () => {
    expect(isValid({})).toBe(true);
  });

  it("returns false when errors exist", () => {
    expect(isValid({ date: "Required" })).toBe(false);
  });
});

describe("buildShift", () => {
  it("builds a shift from valid odometer-mode entry", () => {
    const shift = buildShift(validEntry());
    expect(shift.date).toBe("2025-07-08");
    expect(shift.platform).toBe(Platform.UBER);
    expect(shift.amountEarned).toBe(150);
    expect(shift.tripsCompleted).toBe(12);
    expect(shift.startOdometer).toBe(45000);
    expect(shift.endOdometer).toBe(45128);
    expect(shift.distanceKm).toBe(128);
    expect(shift.entrySource).toBe("MANUAL");
    expect(shift.userId).toBe("mock-user-1");
    expect(shift.id).toBeDefined();
  });

  it("back-calculates startOdometer in distance mode", () => {
    const shift = buildShift(
      validEntry({ odoMode: "distance", startOdometer: "", distance: "128" }),
    );
    expect(shift.startOdometer).toBe(45000);
    expect(shift.endOdometer).toBe(45128);
    expect(shift.distanceKm).toBe(128);
  });

  it("handles fractional back-calculated distance", () => {
    const shift = buildShift(
      validEntry({
        odoMode: "distance",
        startOdometer: "",
        endOdometer: "45128",
        distance: "127.5",
      }),
    );
    expect(shift.startOdometer).toBe(45000.5);
    expect(shift.distanceKm).toBe(127.5);
  });

  it("handles overnight shift (end <= start)", () => {
    const shift = buildShift(
      validEntry({ startTime: "18:00", endTime: "01:30" }),
    );
    const hours = getShiftHours(shift);
    expect(hours).toBeCloseTo(7.5, 1);
    const endDate = new Date(shift.endTime);
    const startDate = new Date(shift.startTime);
    expect(endDate.getDate()).toBe(startDate.getDate() + 1);
  });

  it("handles same-day shift (end > start)", () => {
    const shift = buildShift(
      validEntry({ startTime: "09:00", endTime: "17:00" }),
    );
    const hours = getShiftHours(shift);
    expect(hours).toBeCloseTo(8, 1);
    const endDate = new Date(shift.endTime);
    const startDate = new Date(shift.startTime);
    expect(endDate.getDate()).toBe(startDate.getDate());
  });
});
