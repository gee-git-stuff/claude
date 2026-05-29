import { json } from '@sveltejs/kit';
import { categoryBreakdown, monthLabels, monthlyTimeseries } from '$lib/server/charts.js';

export async function GET({ url }: { url: URL }) {
  const monthsParam = Number(url.searchParams.get('months') ?? '12');
  const months = Math.min(120, Math.max(1, Number.isFinite(monthsParam) ? monthsParam : 12));
  return json({
    months,
    labels: monthLabels(months),
    monthly: monthlyTimeseries(months),
    categories: categoryBreakdown(months)
  });
}
