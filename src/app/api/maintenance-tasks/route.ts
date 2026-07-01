import { listRows, createRow } from "@/lib/crud";
export async function GET() { return listRows("maintenance_tasks", "sort_order"); }
export async function POST(request: Request) { return createRow("maintenance_tasks", await request.json()); }
