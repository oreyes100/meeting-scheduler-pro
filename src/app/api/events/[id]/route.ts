import { updateRow, deleteRow } from "@/lib/crud";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return updateRow("congregation_events", id, await request.json());
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return deleteRow("congregation_events", id);
}
