import { listRows, createRow } from "@/lib/crud";
export async function GET() { return listRows("memorial_roles", "sort_order"); }
export async function POST(request: Request) { return createRow("memorial_roles", await request.json()); }
