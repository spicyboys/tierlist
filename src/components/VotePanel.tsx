"use client";

import { useState, useEffect, useRef } from "react";
import { VoteState } from "@/lib/types";

const VOTE_DURATION = 10_000; // 10 seconds

const TIER_OPTIONS = ["S", "A", "B", "C", "D", "E", "F"] as const;

const TIER_VALUES: Record<string, number> = {
  S: 7,
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  E: 2,
  F: 1,
};

const TIER_COLORS: Record<string, string> = {
  S: "bg-red-500",
  A: "bg-orange-500",
  B: "bg-yellow-500",
  C: "bg-green-500",
  D: "bg-teal-500",
  E: "bg-blue-500",
  F: "bg-purple-500",
};

export function computeVoteResult(responses: Record<string, string>): string {
  const entries = Object.values(responses);
  if (entries.length === 0) return "N/A";
  const total = entries.reduce((sum, tier) => sum + (TIER_VALUES[tier] ?? 4), 0);
  const avg = total / entries.length;

  // Map average back to nearest tier
  let closest = "C";
  let minDist = Infinity;
  for (const [label, value] of Object.entries(TIER_VALUES)) {
    const dist = Math.abs(value - avg);
    if (dist < minDist) {
      minDist = dist;
      closest = label;
    }
  }
  return closest;
}

interface VotePanelProps {
  vote: VoteState | null;
  currentUserId: string;
  totalUsers: number;
  onSubmitVote: (tier: string) => void;
  onResolveVote: (result: string) => void;
  onClearVote: () => void;
}

export default function VotePanel({
  vote,
  currentUserId,
  totalUsers,
  onSubmitVote,
  onResolveVote,
  onClearVote,
}: VotePanelProps) {
  const [timeLeft, setTimeLeft] = useState(VOTE_DURATION);
  const resolvedRef = useRef(false);

  // Timer countdown
  useEffect(() => {
    if (!vote || vote.result) {
      resolvedRef.current = false;
      return;
    }

    resolvedRef.current = false;

    const tick = () => {
      const elapsed = Date.now() - vote.startedAt;
      const remaining = Math.max(0, VOTE_DURATION - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !resolvedRef.current) {
        resolvedRef.current = true;
        const result = computeVoteResult(vote.responses);
        onResolveVote(result);
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [vote, onResolveVote]);

  // Check if all users voted
  useEffect(() => {
    if (!vote || vote.result || resolvedRef.current) return;
    const voteCount = Object.keys(vote.responses).length;
    if (voteCount > 0 && voteCount >= totalUsers) {
      resolvedRef.current = true;
      const result = computeVoteResult(vote.responses);
      onResolveVote(result);
    }
  }, [vote, totalUsers, onResolveVote]);

  if (!vote) return null;

  const myVote = vote.responses[currentUserId];
  const voteCount = Object.keys(vote.responses).length;
  const seconds = Math.ceil(timeLeft / 1000);
  const isExpired = timeLeft <= 0;

  // Show result
  if (vote.result) {
    return (
      <div className="w-[140px] flex-shrink-0 bg-gray-900 border border-gray-700 rounded-lg p-3 flex flex-col items-center gap-2">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          Vote Result
        </div>
        <div className="text-[10px] text-gray-500 truncate max-w-full" title={vote.itemTitle}>
          {vote.itemTitle}
        </div>
        <div
          className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-black text-black ${TIER_COLORS[vote.result] ?? "bg-gray-500"}`}
        >
          {vote.result}
        </div>
        <div className="text-[10px] text-gray-500">
          {voteCount} vote{voteCount !== 1 ? "s" : ""}
        </div>
        <button
          onClick={onClearVote}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Active vote
  return (
    <div className="w-[140px] flex-shrink-0 bg-gray-900 border border-gray-700 rounded-lg p-3 flex flex-col items-center gap-2">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
        Vote
      </div>
      <div className="text-[10px] text-gray-500 truncate max-w-full" title={vote.itemTitle}>
        {vote.itemTitle}
      </div>

      {/* Timer */}
      <div className={`text-lg font-bold tabular-nums ${isExpired ? "text-red-400" : seconds <= 3 ? "text-yellow-400" : "text-white"}`}>
        {isExpired ? "0s" : `${seconds}s`}
      </div>

      {/* Tier buttons */}
      {!myVote ? (
        <div className="grid grid-cols-2 gap-1 w-full">
          {TIER_OPTIONS.map((tier) => (
            <button
              key={tier}
              onClick={() => onSubmitVote(tier)}
              disabled={isExpired}
              className={`text-xs font-bold py-1.5 rounded text-black transition disabled:opacity-30 ${TIER_COLORS[tier]} hover:brightness-110`}
            >
              {tier}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <div className="text-[10px] text-gray-400 mb-1">Your vote</div>
          <div
            className={`w-10 h-10 rounded flex items-center justify-center text-lg font-black text-black mx-auto ${TIER_COLORS[myVote] ?? "bg-gray-500"}`}
          >
            {myVote}
          </div>
        </div>
      )}

      {/* Vote count */}
      <div className="text-[10px] text-gray-500">
        {voteCount}/{totalUsers} voted
      </div>
    </div>
  );
}
