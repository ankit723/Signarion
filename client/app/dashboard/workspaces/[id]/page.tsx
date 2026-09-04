"use client";

import { useParams } from "next/navigation";

import { WorkspaceDetail } from "@/components/workspace/workspace-detail";

export default function WorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  // Key by id so all detail state resets cleanly when navigating between workspaces.
  return <WorkspaceDetail key={params.id} />;
}
