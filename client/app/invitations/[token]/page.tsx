"use client";

import { useParams } from "next/navigation";

import { InvitationLanding } from "@/components/invitations/invitation-landing";

export default function InvitationTokenPage() {
  const params = useParams<{ token: string }>();
  return <InvitationLanding token={params.token} />;
}
