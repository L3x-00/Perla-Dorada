export const raffleActions = [
  "update",
  "activate",
  "close",
  "cancel",
] as const;

export type RaffleAction =
  (typeof raffleActions)[number];

export function isRaffleAction(
  value: unknown,
): value is RaffleAction {
  return (
    typeof value === "string" &&
    raffleActions.includes(
      value as RaffleAction,
    )
  );
}