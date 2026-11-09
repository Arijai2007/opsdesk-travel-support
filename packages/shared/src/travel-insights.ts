export type TravelInsights = {
  total: number;
  closed: number;
  backlog: number;
  breached: number;
  repeatBookings: number;
  medianFirstResponseHours: number | null;
  medianResolutionHours: number | null;
  categories: { category: string; count: number }[];
  days: { date: string; count: number }[];
  suppliers: {
    id: string;
    name: string;
    cases: number;
    open: number;
    overdue: number;
  }[];
};
