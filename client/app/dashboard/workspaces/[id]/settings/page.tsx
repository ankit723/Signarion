"use client";

import { useParams } from "next/navigation";

import { WorkspaceSettings } from "@/components/workspace/workspace-settings";

export default function WorkspaceSettingsPage() {
  const params = useParams<{ id: string }>();
  // Key by id so all settings state resets cleanly when navigating between workspaces.
  return <WorkspaceSettings key={params.id} />;
}
