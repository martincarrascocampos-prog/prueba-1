import { describe, expect, it } from "vitest";
import { computeTopicResult } from "../lib/results";

interface VoteLike {
  userId: number;
  option: string;
  weightAtVote: string;
}

interface MemberLike {
  id: number;
  votingWeight: string;
}

const members: MemberLike[] = [
  { id: 1, votingWeight: "2" },
  { id: 2, votingWeight: "3" },
  { id: 3, votingWeight: "1" },
  { id: 4, votingWeight: "5" },
];

describe("computeTopicResult", () => {
  it("tallies favor/contra/abstención by frozen weight_at_vote", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "2" },
      { userId: 2, option: "contra", weightAtVote: "3" },
      { userId: 3, option: "abstención", weightAtVote: "1" },
    ];
    const attendeeIds = new Set([1, 2, 3, 4]);

    const result = computeTopicResult("abierto", votes, members, attendeeIds);

    expect(result.weights.favor).toBe(2);
    expect(result.weights.contra).toBe(3);
    expect(result.weights.abstención).toBe(1);
    expect(result.weights.sinVoto).toBe(5); // member 4 attended but did not vote
    expect(result.weights.ausente).toBe(0);
    expect(result.weights.total).toBe(11);
    expect(result.voteCount).toBe(3);
  });

  it("uses the frozen weight_at_vote, not the member's current weight", () => {
    // Member 1 currently weighs 2, but voted while their weight was 10.
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "10" },
    ];
    const attendeeIds = new Set([1]);

    const result = computeTopicResult(
      "abierto",
      votes,
      [{ id: 1, votingWeight: "2" }],
      attendeeIds,
    );

    expect(result.weights.favor).toBe(10);
    expect(result.weights.total).toBe(10);
  });

  it("counts non-voters as sinVoto (attended) or ausente (absent) using current weight", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "2" },
    ];
    // Member 2 attended but did not vote -> sinVoto (weight 3)
    // Members 3 and 4 were absent -> ausente (weights 1 + 5 = 6)
    const attendeeIds = new Set([1, 2]);

    const result = computeTopicResult("abierto", votes, members, attendeeIds);

    expect(result.weights.favor).toBe(2);
    expect(result.weights.sinVoto).toBe(3);
    expect(result.weights.ausente).toBe(6);
    expect(result.weights.total).toBe(11);
  });

  it("computes percentages relative to the total weight", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "2" },
      { userId: 2, option: "contra", weightAtVote: "2" },
    ];
    const attendeeIds = new Set([1, 2]);

    const result = computeTopicResult(
      "abierto",
      votes,
      [
        { id: 1, votingWeight: "2" },
        { id: 2, votingWeight: "2" },
      ],
      attendeeIds,
    );

    expect(result.percentages.favor).toBe(50);
    expect(result.percentages.contra).toBe(50);
    expect(result.percentages.total).toBe(100);
  });

  it("marks approved=true when favor outweighs contra on a closed topic", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "5" },
      { userId: 2, option: "contra", weightAtVote: "3" },
    ];
    const attendeeIds = new Set([1, 2]);

    const result = computeTopicResult("cerrado", votes, members, attendeeIds);

    expect(result.approved).toBe(true);
  });

  it("marks approved=false when contra outweighs favor on a closed topic", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "3" },
      { userId: 2, option: "contra", weightAtVote: "5" },
    ];
    const attendeeIds = new Set([1, 2]);

    const result = computeTopicResult("cerrado", votes, members, attendeeIds);

    expect(result.approved).toBe(false);
  });

  it("treats a tie as not approved (favor must strictly exceed contra)", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "4" },
      { userId: 2, option: "contra", weightAtVote: "4" },
    ];
    const attendeeIds = new Set([1, 2]);

    const result = computeTopicResult("cerrado", votes, members, attendeeIds);

    expect(result.weights.favor).toBe(result.weights.contra);
    expect(result.approved).toBe(false);
  });

  it("leaves approved=null while the topic is still open", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "5" },
      { userId: 2, option: "contra", weightAtVote: "1" },
    ];
    const attendeeIds = new Set([1, 2]);

    const result = computeTopicResult("abierto", votes, members, attendeeIds);

    expect(result.approved).toBeNull();
  });

  it("handles no votes at all (everyone absent)", () => {
    const result = computeTopicResult("abierto", [], members, new Set());

    expect(result.weights.favor).toBe(0);
    expect(result.weights.contra).toBe(0);
    expect(result.weights.abstención).toBe(0);
    expect(result.weights.sinVoto).toBe(0);
    expect(result.weights.ausente).toBe(11); // all four members absent
    expect(result.weights.total).toBe(11);
    expect(result.voteCount).toBe(0);
    expect(result.percentages.ausente).toBe(100);
  });

  it("returns 0% across the board when total weight is zero", () => {
    const result = computeTopicResult("abierto", [], [], new Set());

    expect(result.weights.total).toBe(0);
    expect(result.percentages.favor).toBe(0);
    expect(result.percentages.ausente).toBe(0);
    expect(result.voteCount).toBe(0);
  });

  it("no votes on a closed topic results in not approved (0 favor vs 0 contra)", () => {
    const result = computeTopicResult("cerrado", [], members, new Set());

    expect(result.approved).toBe(false);
  });

  it("still counts an already-cast vote from a member no longer on the roster", () => {
    // Member 99 has since retired/left and is gone from the members list, but
    // their finalized vote row persists and must keep counting at its frozen weight.
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "2" },
      { userId: 99, option: "favor", weightAtVote: "4" },
    ];
    const attendeeIds = new Set([1]);

    const result = computeTopicResult(
      "abierto",
      votes,
      [{ id: 1, votingWeight: "2" }],
      attendeeIds,
    );

    // The retired member's favor vote still adds its frozen weight (2 + 4).
    expect(result.weights.favor).toBe(6);
    expect(result.voteCount).toBe(2);
    // They are not re-counted as sinVoto/ausente since they are off the roster.
    expect(result.weights.sinVoto).toBe(0);
    expect(result.weights.ausente).toBe(0);
    expect(result.weights.total).toBe(6);
  });

  it("excludes checked-out (retired) members from votes and from sinVoto/ausente", () => {
    const votes: VoteLike[] = [
      { userId: 1, option: "favor", weightAtVote: "2" },
      { userId: 2, option: "contra", weightAtVote: "3" }, // member 2 retired
    ];
    const attendeeIds = new Set([1, 2, 3]);
    const checkedOutIds = new Set([2]);

    const result = computeTopicResult(
      "abierto",
      votes,
      members,
      attendeeIds,
      checkedOutIds,
    );

    // Member 2's contra vote is dropped entirely.
    expect(result.weights.contra).toBe(0);
    expect(result.weights.favor).toBe(2);
    // Member 3 attended, did not vote -> sinVoto (weight 1).
    expect(result.weights.sinVoto).toBe(1);
    // Member 4 absent -> ausente (weight 5). Member 2 excluded from both.
    expect(result.weights.ausente).toBe(5);
    expect(result.weights.total).toBe(8);
    expect(result.voteCount).toBe(1); // checked-out member's vote excluded from count
  });
});
