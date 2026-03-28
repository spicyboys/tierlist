import { redirect } from "next/navigation";
import { getAuthenticatedAppForUser } from "@/lib/firebase/server";

export default async function LoggedInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = await getAuthenticatedAppForUser();

  if (!currentUser) {
    redirect("/");
  }

  return <>{children}</>;
}
