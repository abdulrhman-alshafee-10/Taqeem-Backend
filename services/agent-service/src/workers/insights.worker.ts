import axios from "axios";
// In a real setup, we would import the PrismaClient from agent-service to save the WeeklyInsight 
// or call the Business Service API to save it. 
// For phase 9 we'll mock the worker that runs on a cron job.

export async function generateInsight(businessId: string) {
  try {
    // 1. Fetch reviews
    // const reviews = await axios.get(`${process.env.REVIEW_SERVICE_URL}/internal/businesses/${businessId}/recent?days=30`);
    // 2. Fetch analytics
    // const analytics = await axios.get(`${process.env.ANALYTICS_SERVICE_URL}/internal/businesses/${businessId}/summary?days=30`);
    
    // 3. Mock LLM insight generation
    const insight = {
      headline: "Strong ratings, but slower service noted.",
      ratingDelta: -0.1,
      wins: ["Customers love the new outdoor seating", "High praise for the espresso"],
      concerns: [
        { theme: "Speed", count: 4, example: "Waited 20 minutes for a coffee" }
      ],
      suggestions: ["Consider adding a dedicated barista during morning rush hours"]
    };

    // 4. Save to business-service or local DB
    console.log(`Generated insight for business ${businessId}:`, insight);

    return insight;
  } catch (error) {
    console.error("Failed to generate insight", error);
  }
}

// In a real application, a cron scheduler (like node-cron or BullMQ) would call this function 
// for every business on a weekly basis.
