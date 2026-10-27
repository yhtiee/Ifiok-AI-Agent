import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { libraryUploadBody, uploadToLibrary } from "@/lib/contribute/library-upload";

// POST /api/library/upload — share your own material straight to the Library (12 §4 Q58).
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, libraryUploadBody);
  return NextResponse.json(await uploadToLibrary(viewer, body), { status: 201 });
});
