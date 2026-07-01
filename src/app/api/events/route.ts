import { listRows, createRow } from "@/lib/crud";
export async function GET() { return listRows("congregation_events", "start_date"); }
export async function POST(request: Request) { return createRow("congregation_events", await request.json()); }
