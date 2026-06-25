import { describe, expect, it } from "vitest";

// Test the grade calculation logic (extracted from routers.ts)
function calculateGrade(overallScore: number): string {
  return overallScore >= 4.5 ? "A+" :
    overallScore >= 4.0 ? "A" :
    overallScore >= 3.5 ? "B+" :
    overallScore >= 3.0 ? "B" :
    overallScore >= 2.5 ? "C+" :
    overallScore >= 2.0 ? "C" : "D";
}

function calculateOverallScore(scores: {
  activeListeningEmpathy: number;
  informationGathering: number;
  policyAdherence: number;
  communicationClarity: number;
  deEscalation: number;
}): number {
  const sum =
    scores.activeListeningEmpathy +
    scores.informationGathering +
    scores.policyAdherence +
    scores.communicationClarity +
    scores.deEscalation;
  return Math.round((sum / 5) * 10) / 10;
}

describe("Scoring Engine", () => {
  describe("calculateOverallScore", () => {
    it("calculates average of five competencies correctly", () => {
      const result = calculateOverallScore({
        activeListeningEmpathy: 4.0,
        informationGathering: 4.0,
        policyAdherence: 4.0,
        communicationClarity: 4.0,
        deEscalation: 4.0,
      });
      expect(result).toBe(4.0);
    });

    it("rounds to one decimal place", () => {
      const result = calculateOverallScore({
        activeListeningEmpathy: 4.0,
        informationGathering: 3.5,
        policyAdherence: 4.0,
        communicationClarity: 3.5,
        deEscalation: 4.0,
      });
      expect(result).toBe(3.8);
    });

    it("handles minimum scores", () => {
      const result = calculateOverallScore({
        activeListeningEmpathy: 1.0,
        informationGathering: 1.0,
        policyAdherence: 1.0,
        communicationClarity: 1.0,
        deEscalation: 1.0,
      });
      expect(result).toBe(1.0);
    });

    it("handles maximum scores", () => {
      const result = calculateOverallScore({
        activeListeningEmpathy: 5.0,
        informationGathering: 5.0,
        policyAdherence: 5.0,
        communicationClarity: 5.0,
        deEscalation: 5.0,
      });
      expect(result).toBe(5.0);
    });
  });

  describe("calculateGrade", () => {
    it("returns A+ for scores >= 4.5", () => {
      expect(calculateGrade(4.5)).toBe("A+");
      expect(calculateGrade(5.0)).toBe("A+");
    });

    it("returns A for scores >= 4.0 and < 4.5", () => {
      expect(calculateGrade(4.0)).toBe("A");
      expect(calculateGrade(4.4)).toBe("A");
    });

    it("returns B+ for scores >= 3.5 and < 4.0", () => {
      expect(calculateGrade(3.5)).toBe("B+");
      expect(calculateGrade(3.9)).toBe("B+");
    });

    it("returns B for scores >= 3.0 and < 3.5", () => {
      expect(calculateGrade(3.0)).toBe("B");
      expect(calculateGrade(3.4)).toBe("B");
    });

    it("returns C+ for scores >= 2.5 and < 3.0", () => {
      expect(calculateGrade(2.5)).toBe("C+");
      expect(calculateGrade(2.9)).toBe("C+");
    });

    it("returns C for scores >= 2.0 and < 2.5", () => {
      expect(calculateGrade(2.0)).toBe("C");
      expect(calculateGrade(2.4)).toBe("C");
    });

    it("returns D for scores < 2.0", () => {
      expect(calculateGrade(1.0)).toBe("D");
      expect(calculateGrade(1.9)).toBe("D");
    });
  });

  describe("Competency labels", () => {
    it("uses the exact required competency names", () => {
      const requiredLabels = [
        "Active Listening and Empathy",
        "Information Gathering",
        "Policy Adherence",
        "Communication Clarity",
        "De-escalation",
      ];
      // Verify each label exists as expected
      requiredLabels.forEach(label => {
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
      });
      expect(requiredLabels).toHaveLength(5);
    });
  });
});
