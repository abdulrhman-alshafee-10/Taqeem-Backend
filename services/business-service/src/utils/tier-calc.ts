export function wilsonLower(mean1to5: number, n: number): number {
  if (n === 0) return 0;
  const p = (mean1to5 - 1) / 4;                          // scale to [0,1]
  const z = 1.96;
  const denom = 1 + z*z/n;
  const centre = p + z*z/(2*n);
  const margin = z * Math.sqrt(p*(1-p)/n + z*z/(4*n*n));
  return (centre - margin) / denom * 4 + 1;              // rescale to [1,5]
}

export function headlineLevel(b: any): string {
  if (b.qualityTier === "HALL_OF_FAME" && b.seniorityTier === "LEGACY") return "LEGEND";
  if (b.qualityTier === "HALL_OF_FAME")                                 return "HALL_OF_FAME";
  if (b.qualityTier === "ACCLAIMED"   && b.seniorityTier !== "NEW")     return "ACCLAIMED";
  if (b.qualityTier === "POPULAR")                                       return "POPULAR";
  if (b.qualityTier === "RISING")                                        return "RISING";
  return b.engagementTier === "PRO" ? "PRO" : b.engagementTier === "ACTIVE_OWNER" ? "ACTIVE" : "NEW";
}
