import { listRows, createRow } from "@/lib/crud";
export async function GET() { return listRows("circuit_overseer_visits", "week_date"); }
export async function POST(request: Request) { return createRow("circuit_overseer_visits", await request.json()); }
